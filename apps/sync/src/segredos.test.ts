import { inspect } from "node:util";

import { atividade, diaResumo, diaSono, diaHrv, zonaFc, perfilTreino } from "@sou-atleta/db";
import { GarminKey } from "@sou-atleta/garmin";
import { atividadeBruta, VALORES_PROIBIDOS } from "@sou-atleta/garmin/teste";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registrarNoConsole, type EventoDeLog } from "./log.js";
import { sincronizar } from "./sincronizar.js";
import {
  CHAVE_FALSA,
  historicoSintetico,
  montarAmbiente,
  QUINZE_MINUTOS,
} from "./teste/ambiente.js";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Dados de saúde da fixture que não podem ir parar num log. */
const DADOS_DE_SAUDE = ["BALANCED", "HRV_BALANCED", "27000", "hrvNoiteMs", "vo2max", "fcMedia"];

/**
 * Teste da chave falsa (issue #5): a chave passa pelo fluxo inteiro, com a troca por token, a
 * importação e erros forçados (chave recusada, 429, 5xx, formato errado, falha de rede), e depois
 * se verifica que nem ela nem os tokens aparecem em nenhuma tabela, nenhuma linha de log nem
 * nenhuma mensagem de erro.
 */
async function rodarOFluxoInteiro(registrar: (evento: EventoDeLog) => void) {
  const dados = historicoSintetico();
  const a = montarAmbiente({
    dados: {
      atividades: [...dados.atividades, atividadeBruta(77, "2026-09-02", { startTimeLocal: 5 })],
      diasDeSaude: dados.diasDeSaude,
    },
  });
  const executar = async (modo: "agendada" | "manual" = "agendada") => {
    a.avancar(QUINZE_MINUTOS * 5);
    return sincronizar({ ...a.dependencias(), registrar }, modo);
  };

  for (let i = 0; i < 12; i += 1) await executar(); // importação normal (e o formato quebrado)
  a.garmin.forcarFalha("hrv-service", { status: 429, cabecalhos: { "Retry-After": "60" } });
  await executar();
  a.garmin.limparFalhas();
  a.garmin.forcarFalha("sleep-service", { status: 503, vezes: 1 });
  await executar();
  a.garmin.forcarFalha("userprofile", { status: 403, vezes: 1 });
  a.avancar(25 * 3_600_000);
  await executar("manual");
  a.avancar(8 * 3_600_000);
  a.garmin.revogarChave();
  a.avancar(25 * 3_600_000);
  await executar();
  a.avancar(2 * 3_600_000);
  await executar("manual");
  return a;
}

describe("a chave e o token nunca saem do cofre e da memória", () => {
  it("não aparecem em nenhuma tabela, em nenhum evento de log nem em nenhuma mensagem", async () => {
    const eventos: EventoDeLog[] = [];
    const a = await rodarOFluxoInteiro((e) => eventos.push(e));

    const segredos = [
      CHAVE_FALSA,
      ...a.garmin.tokensEmitidos(),
      "ApiKey",
      "Bearer",
      "Authorization",
    ];
    expect(a.garmin.tokensEmitidos().length).toBeGreaterThan(1); // trocou a chave por tokens
    const despejo = a.memoria.despejo();
    const logs = JSON.stringify(eventos);
    for (const segredo of segredos) {
      expect(despejo, `tabela contém ${segredo}`).not.toContain(segredo);
      expect(logs, `log contém ${segredo}`).not.toContain(segredo);
    }
    expect(eventos.length).toBeGreaterThan(20);
    expect(eventos.map((e) => e.evento)).toEqual(
      expect.arrayContaining(["limite_garmin", "chave_invalida", "garmin_indisponivel"]),
    );
  });

  it("a saída real do log (console) também não leva segredo, URL, cabeçalho nem dado de saúde", async () => {
    const linhas: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      linhas.push(args.map(String).join(" "));
    });
    const a = await rodarOFluxoInteiro(registrarNoConsole);

    expect(linhas.length).toBeGreaterThan(20);
    const tudo = linhas.join("\n");
    for (const proibido of [
      CHAVE_FALSA,
      ...a.garmin.tokensEmitidos(),
      ...VALORES_PROIBIDOS,
      ...DADOS_DE_SAUDE,
      "personal.connectapi",
      "http",
      "ApiKey",
      "Bearer",
      "Authorization",
    ]) {
      expect(tudo, proibido).not.toContain(proibido);
    }
    // Cada linha é um evento JSON de uma lista fechada.
    for (const linha of linhas) {
      const evento = JSON.parse(linha) as { evento: string };
      expect(evento.evento).not.toBe("log_invalido");
    }
  });

  it("imprimir ou serializar a GarminKey resulta em [REDACTED], inclusive dentro de erros e objetos", () => {
    const chave = GarminKey.de(CHAVE_FALSA);
    const erro = new Error(`falhou com ${String(chave)}`);
    const todas = [
      String(chave),
      JSON.stringify({ chave }),
      inspect({ chave, aninhado: [chave] }, { depth: 6 }),
      erro.message,
      JSON.stringify(Object.assign(new Error("x"), { chave })),
    ];
    for (const texto of todas) expect(texto).not.toContain(CHAVE_FALSA);
    expect(String(chave)).toBe("[REDACTED]");
  });
});

describe("minimização de dados", () => {
  it("GPS, local, nome, e-mail e foto da resposta da Garmin não chegam ao banco", async () => {
    const a = montarAmbiente();
    for (let i = 0; i < 15; i += 1) {
      await sincronizar(a.dependencias(), "agendada");
      a.avancar(QUINZE_MINUTOS);
    }
    const despejo = a.memoria.despejo();
    expect(despejo).toContain("atividade:");
    for (const proibido of [
      ...VALORES_PROIBIDOS,
      "Nota pessoal secreta",
      "987654321",
      "123e4567",
    ]) {
      expect(despejo, proibido).not.toContain(proibido);
    }
    // E o banco não tem sequer uma coluna para isso (ver também packages/db).
    const colunas = Object.values(a.memoria.colunas()).flat().join(" ");
    expect(colunas).not.toMatch(/latitude|longitude|polyline|display|full_?name|e_?mail|foto/i);
  });

  it("todo registro gravado tem fonte garmin, e a FC de atividade é pulso, cinta ou desconhecido", async () => {
    const dados = historicoSintetico();
    const a = montarAmbiente({
      dados: {
        ...dados,
        sensores: {
          1000: [{ sourceType: "ANTPLUS", antplusDeviceType: "HEART_RATE" }],
          1001: [{ sourceType: "LOCAL", localDeviceType: "WHR" }],
        },
      },
    });
    for (let i = 0; i < 60; i += 1) {
      await sincronizar(a.dependencias(), "agendada");
      a.avancar(QUINZE_MINUTOS);
    }
    const tabelas = [atividade, diaHrv, diaSono, diaResumo, zonaFc, perfilTreino];
    for (const tabela of tabelas) {
      const linhas = await a.banco.select().from(tabela);
      expect(linhas.length).toBeGreaterThan(0);
      const fontes: string[] = linhas.map((l) => l.fonte);
      expect(new Set(fontes)).toEqual(new Set(["garmin"]));
    }
    const ativ = await a.banco.select().from(atividade);
    const porId = new Map(ativ.map((l) => [l.id, l]));
    expect(porId.get(1000)).toMatchObject({ fcOrigem: "cinta", fcOrigemConferida: true });
    expect(porId.get(1001)).toMatchObject({ fcOrigem: "pulso", fcOrigemConferida: true });
    expect(porId.get(1002)).toMatchObject({ fcOrigem: "desconhecido", fcOrigemConferida: true });
    expect(ativ.every((l) => ["pulso", "cinta", "desconhecido"].includes(l.fcOrigem))).toBe(true);
    const resumos = await a.banco.select().from(diaResumo);
    expect(resumos.every((l) => l.fcRepousoOrigem === "desconhecido")).toBe(true);
  });
});

describe("o log só aceita eventos de uma lista fechada", () => {
  const capturar = (evento: unknown): string => {
    const linhas: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      linhas.push(args.map(String).join(" "));
    });
    registrarNoConsole(evento as EventoDeLog);
    return linhas.join("\n");
  };

  it("evento com campo a mais, evento desconhecido ou campo fora do formato viram log_invalido", () => {
    const segredo = "valor-que-nao-pode-sair";
    for (const ruim of [
      { evento: "chave_invalida", chave: segredo },
      { evento: "inventado", valor: segredo },
      { evento: "formato_inesperado", onde: "sono", campos: [segredo + " com espaço"] },
      {
        evento: "janela_importada",
        fluxo: "sono",
        itens: 1,
        historicoCompleto: true,
        dado: segredo,
      },
      { evento: "janela_importada", fluxo: segredo, itens: 1, historicoCompleto: true },
      "texto solto",
      { mensagem: segredo },
    ]) {
      const saida = capturar(ruim);
      expect(saida).toBe('{"evento":"log_invalido"}');
      expect(saida).not.toContain(segredo);
    }
  });

  it("propriedade: nenhum texto livre passa pelo campo 'campos' do formato inesperado", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 40 }), (texto) => {
        const saida = capturar({ evento: "formato_inesperado", onde: "sono", campos: [texto] });
        const passou = /^[A-Za-z0-9_.]{1,80}$/.test(texto);
        expect(saida.includes('"log_invalido"')).toBe(!passou);
        vi.restoreAllMocks();
      }),
    );
  });
});
