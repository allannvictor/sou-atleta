import { criarBanco, lerFotoDaSincronizacao } from "@sou-atleta/db";
import { criarD1EmMemoria } from "@sou-atleta/db/teste";
import { criarGarminFalsa } from "@sou-atleta/garmin/teste";
import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "./index.js";
import { CHAVE_FALSA, historicoSintetico } from "./teste/ambiente.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function contexto() {
  const pendentes: Promise<unknown>[] = [];
  return {
    ctx: {
      waitUntil: (p: Promise<unknown>) => {
        pendentes.push(p);
      },
      passThroughOnException: () => undefined,
    } as unknown as ExecutionContext,
    terminar: () => Promise.all(pendentes),
  };
}

const pedir = (caminho: string, metodo = "POST") =>
  new Request(`https://sync.interno${caminho}`, { method: metodo });

/** Garmin que recusa a chave: a execução termina na primeira requisição, sem pausas. */
const garminQueRecusa = () =>
  criarGarminFalsa({
    chave: "outra-chave-qualquer-123456",
    agora: () => Date.now(),
    dados: historicoSintetico(),
  });

describe("Worker sync: portas /ao-abrir e /atualizar", () => {
  it("não tem rotina agendada (Cron): só responde a pedidos do site", () => {
    expect("scheduled" in worker).toBe(false);
  });

  it("só responde a POST /atualizar e POST /ao-abrir; o resto é 404", async () => {
    const env: Env = { DB: criarD1EmMemoria().d1 };
    const { ctx } = contexto();
    for (const [caminho, metodo] of [
      ["/atualizar", "GET"],
      ["/ao-abrir", "GET"],
      ["/", "POST"],
      ["/atualizar/x", "POST"],
      ["/estado", "GET"],
    ] as const) {
      const resposta = await worker.fetch(pedir(caminho, metodo), env, ctx);
      expect(resposta.status, `${metodo} ${caminho}`).toBe(404);
    }
  });

  it("sem chave no cofre: responde 'sem_chave' e não chama a Garmin", async () => {
    const chamadas: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      chamadas.push(url);
      return Promise.reject(new Error("não devia chamar a Garmin"));
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const memoria = criarD1EmMemoria();
    const resposta = await worker.fetch(pedir("/atualizar"), { DB: memoria.d1 }, contexto().ctx);
    expect(await resposta.json()).toEqual({ resultado: "sem_chave" });
    expect(chamadas).toEqual([]);
    const foto = await lerFotoDaSincronizacao(criarBanco(memoria.d1));
    expect(foto.estado?.statusDaChave).toBe("ausente");
  });

  it("ao abrir a página: responde 202 'iniciada' na hora e termina em segundo plano; a abertura seguinte é recusada por 10 min", async () => {
    vi.stubGlobal("fetch", garminQueRecusa().fetch);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const memoria = criarD1EmMemoria();
    const env: Env = {
      DB: memoria.d1,
      GARMIN_API_KEY: CHAVE_FALSA,
      GARMIN_CHAVE_VENCE_EM: "2027-03-01",
    };
    const { ctx, terminar } = contexto();

    const resposta = await worker.fetch(pedir("/ao-abrir"), env, ctx);
    expect(resposta.status).toBe(202);
    expect(await resposta.json()).toEqual({ resultado: "iniciada" });
    await terminar();

    const foto = await lerFotoDaSincronizacao(criarBanco(memoria.d1));
    expect(foto.estado).toMatchObject({
      statusDaChave: "invalida",
      chaveVenceEm: "2027-03-01",
      travaAte: null,
    });

    const outra = await worker.fetch(pedir("/ao-abrir"), env, contexto().ctx);
    expect(await outra.json()).toEqual({ resultado: "pausada" }); // chave recusada: pausa de 1 h
  });

  it("o botão espera o fim e diz o que de fato aconteceu: chave recusada, não 'iniciada'", async () => {
    vi.stubGlobal("fetch", garminQueRecusa().fetch);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const memoria = criarD1EmMemoria();
    const env: Env = { DB: memoria.d1, GARMIN_API_KEY: CHAVE_FALSA };
    const resposta = await worker.fetch(pedir("/atualizar"), env, contexto().ctx);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ resultado: "chave_recusada" });
    const outra = await worker.fetch(pedir("/atualizar"), env, contexto().ctx);
    expect(await outra.json()).toEqual({ resultado: "muito_cedo" });
  });

  it("data de vencimento com formato errado é ignorada, sem derrubar nada", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const memoria = criarD1EmMemoria();
    await worker.fetch(
      pedir("/atualizar"),
      { DB: memoria.d1, GARMIN_API_KEY: "  ", GARMIN_CHAVE_VENCE_EM: "amanhã" },
      contexto().ctx,
    );
    const foto = await lerFotoDaSincronizacao(criarBanco(memoria.d1));
    expect(foto.estado).toMatchObject({ statusDaChave: "ausente", chaveVenceEm: null });
  });

  it("chave com aspas coladas junto vira 'mal_formada', sem chamar a Garmin", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("não devia chamar a Garmin")));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const memoria = criarD1EmMemoria();
    const resposta = await worker.fetch(
      pedir("/atualizar"),
      { DB: memoria.d1, GARMIN_API_KEY: `"${CHAVE_FALSA}"` },
      contexto().ctx,
    );
    expect(await resposta.json()).toEqual({ resultado: "sem_chave" });
    const foto = await lerFotoDaSincronizacao(criarBanco(memoria.d1));
    expect(foto.estado?.statusDaChave).toBe("mal_formada");
  });

  it("erro ao montar as dependências (banco quebrado) não escapa: 500 sem detalhe, log só com evento", async () => {
    const linhas: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      linhas.push(args.map(String).join(" "));
    });
    const segredo = `senha-do-banco-${CHAVE_FALSA}`;
    const envQuebrado = {
      get DB(): D1Database {
        throw new Error(`falha ao abrir o banco com ${segredo}`);
      },
      GARMIN_API_KEY: CHAVE_FALSA,
    } as unknown as Env;
    for (const caminho of ["/atualizar", "/ao-abrir"]) {
      const resposta = await worker.fetch(pedir(caminho), envQuebrado, contexto().ctx);
      expect(resposta.status).toBe(500);
      expect(await resposta.json()).toEqual({ resultado: "erro" });
    }
    expect(linhas.join("\n")).not.toContain(segredo);
    expect(linhas.join("\n")).not.toContain(CHAVE_FALSA);
    expect(linhas.every((l) => l === '{"evento":"erro_interno"}')).toBe(true);
  });
});
