import { VALORES_PROIBIDOS } from "@sou-atleta/garmin/teste";
import { criarD1EmMemoria } from "@sou-atleta/db/teste";
import { criarGarminFalsa } from "@sou-atleta/garmin/teste";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import worker from "./index.js";
import { CHAVE_FALSA, historicoSintetico } from "./teste/ambiente.js";

/**
 * Teste da chave falsa pelo caminho de verdade (issue #5, critério 4): a chave entra pelo
 * `env.GARMIN_API_KEY` da Worker e o roteiro passa por `POST /ao-abrir` e `POST /atualizar`, com
 * falha de rede e falha do banco forçadas por erros CUJA MENSAGEM TRAZ A CHAVE E A URL. Guarda
 * toda exceção que escapar, todo corpo de resposta e tudo que sair por qualquer método do
 * `console`, e confere que nada disso (nem as tabelas) leva a chave, o token, cabeçalhos ou dado
 * de saúde.
 */

const SAIDAS: string[] = [];
const EXCECOES: unknown[] = [];

const registrar = (...args: unknown[]) => {
  SAIDAS.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
};

beforeEach(() => {
  SAIDAS.length = 0;
  EXCECOES.length = 0;
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  for (const metodo of ["log", "error", "warn", "info", "debug"] as const) {
    vi.spyOn(console, metodo).mockImplementation(registrar);
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a chave falsa passa pelo Worker inteiro", () => {
  it("nenhum caminho (tabelas, console, respostas, exceções) leva a chave, o token ou dado de saúde", async () => {
    const memoria = criarD1EmMemoria();
    const garmin = criarGarminFalsa({
      chave: CHAVE_FALSA,
      agora: () => Date.now(),
      dados: historicoSintetico(),
    });
    let rede: "ok" | "cai" = "ok";
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (rede === "cai") {
        return Promise.reject(
          new Error(`ECONNRESET ${url} Authorization: ApiKey ${CHAVE_FALSA} Bearer token-falso-1`),
        );
      }
      return garmin.fetch(url, init);
    });

    let bancoQuebrado = false;
    const d1 = memoria.d1;
    const banco = new Proxy(d1, {
      get(alvo, propriedade, receptor) {
        if (bancoQuebrado && (propriedade === "batch" || propriedade === "prepare")) {
          return () => {
            throw new Error(`D1_ERROR: falha com ${CHAVE_FALSA} em /personalapitoken-service`);
          };
        }
        return Reflect.get(alvo, propriedade, receptor) as unknown;
      },
    });
    const env: Env = {
      DB: banco,
      GARMIN_API_KEY: CHAVE_FALSA,
      GARMIN_CHAVE_VENCE_EM: "2027-03-01",
      POLITICA_REVISTA: "sim",
    };

    const corpos: string[] = [];
    const pendentes: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => pendentes.push(p),
      passThroughOnException: () => undefined,
    } as unknown as ExecutionContext;

    const chamar = async (caminho: "/ao-abrir" | "/atualizar") => {
      const requisicao = new Request(`https://sync.interno${caminho}`, { method: "POST" });
      const execucao = (async () => {
        try {
          const resposta = await worker.fetch(requisicao, env, ctx);
          corpos.push(await resposta.text());
        } catch (erro) {
          EXCECOES.push(erro);
        }
        await Promise.allSettled(pendentes.splice(0));
      })();
      await vi.runAllTimersAsync(); // a pausa de 1,5 s entre requisições passa na hora
      await execucao;
    };
    const depoisDeUmTempo = (minutos: number) => vi.advanceTimersByTimeAsync(minutos * 60_000);

    // 1. Funcionamento normal (troca de token e importação).
    await chamar("/ao-abrir");
    await depoisDeUmTempo(11);
    await chamar("/atualizar");
    // 2. Falha de rede, com chave, URL e token dentro da mensagem do erro.
    rede = "cai";
    await depoisDeUmTempo(11);
    await chamar("/atualizar");
    await depoisDeUmTempo(11);
    await chamar("/ao-abrir");
    rede = "ok";
    // 3. Falha do banco.
    bancoQuebrado = true;
    await depoisDeUmTempo(11);
    await chamar("/atualizar");
    await chamar("/ao-abrir");
    bancoQuebrado = false;
    // 4. 429, 503 e chave revogada.
    const ENDPOINTS_DE_DADOS = ["activitylist", "dailysummaries", "sleep-service", "hrv-service"];
    for (const trecho of ENDPOINTS_DE_DADOS) {
      garmin.forcarFalha(trecho, { status: 429, cabecalhos: { "Retry-After": "60" } });
    }
    await depoisDeUmTempo(11);
    await chamar("/atualizar");
    garmin.limparFalhas();
    for (const trecho of ENDPOINTS_DE_DADOS) garmin.forcarFalha(trecho, { status: 503 });
    await depoisDeUmTempo(60);
    await chamar("/atualizar");
    garmin.limparFalhas();
    garmin.revogarChave();
    await depoisDeUmTempo(24 * 60 + 5);
    await chamar("/atualizar");
    await depoisDeUmTempo(70);
    await chamar("/ao-abrir");

    // ---- Prova: o roteiro rodou de verdade e nada vazou.
    expect(garmin.tokensEmitidos().length).toBeGreaterThan(0);
    expect(EXCECOES).toEqual([]); // nenhuma exceção escapou do Worker
    expect(SAIDAS.length).toBeGreaterThan(10);
    expect(corpos.length).toBeGreaterThanOrEqual(10);

    const saidas = SAIDAS.join("\n");
    const respostas = corpos.join("\n");
    const eventos = saidas.split("\n").map((l) => (JSON.parse(l) as { evento: string }).evento);
    expect(eventos).toEqual(
      expect.arrayContaining([
        "janela_importada",
        "erro_de_rede",
        "erro_interno",
        "limite_garmin",
        "garmin_indisponivel",
        "chave_invalida",
      ]),
    );
    expect(eventos).not.toContain("log_invalido");

    const proibidos = [
      CHAVE_FALSA,
      ...garmin.tokensEmitidos(),
      ...VALORES_PROIBIDOS,
      "ApiKey",
      "Bearer",
      "Authorization",
      "personal.connectapi",
      "http",
      "D1_ERROR",
      "ECONNRESET",
      "BALANCED",
      "27000",
    ];
    const tabelas = memoria.despejo();
    for (const proibido of proibidos) {
      expect(saidas, `console contém ${proibido}`).not.toContain(proibido);
      expect(respostas, `resposta contém ${proibido}`).not.toContain(proibido);
      expect(JSON.stringify(EXCECOES), `exceção contém ${proibido}`).not.toContain(proibido);
    }
    for (const proibido of [CHAVE_FALSA, ...garmin.tokensEmitidos(), "ApiKey", "Bearer"]) {
      expect(tabelas, `tabela contém ${proibido}`).not.toContain(proibido);
    }
    // As respostas só têm palavras de uma lista fechada.
    for (const corpo of corpos) {
      expect(corpo).toMatch(/^\{"resultado":"[a-z_]+"\}$/);
    }
  });
});
