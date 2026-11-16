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

describe("Worker sync: porta do botão Atualizar agora", () => {
  it("só responde a POST /atualizar; o resto é 404", async () => {
    const memoria = criarD1EmMemoria();
    const env: Env = { DB: memoria.d1 };
    const { ctx } = contexto();
    for (const [caminho, metodo] of [
      ["/atualizar", "GET"],
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

  it("com a chave: responde 202 'iniciada' na hora e termina em segundo plano; a segunda chamada é recusada", async () => {
    // Garmin que recusa a chave: a execução termina na primeira requisição, sem pausas.
    const garmin = criarGarminFalsa({
      chave: "outra-chave-qualquer-123456",
      agora: () => Date.now(),
      dados: historicoSintetico(),
    });
    vi.stubGlobal("fetch", garmin.fetch);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const memoria = criarD1EmMemoria();
    const env: Env = {
      DB: memoria.d1,
      GARMIN_API_KEY: CHAVE_FALSA,
      GARMIN_CHAVE_VENCE_EM: "2027-03-01",
    };
    const { ctx, terminar } = contexto();

    const resposta = await worker.fetch(pedir("/atualizar"), env, ctx);
    expect(resposta.status).toBe(202);
    expect(await resposta.json()).toEqual({ resultado: "iniciada" });
    await terminar();

    const foto = await lerFotoDaSincronizacao(criarBanco(memoria.d1));
    expect(foto.estado).toMatchObject({
      statusDaChave: "invalida",
      chaveVenceEm: "2027-03-01",
      travaAte: null,
    });

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
});

describe("Worker sync: cron", () => {
  it("o gatilho agendado roda a sincronização e solta a trava", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const memoria = criarD1EmMemoria();
    const { ctx, terminar } = contexto();
    worker.scheduled({} as ScheduledController, { DB: memoria.d1 }, ctx);
    await terminar();
    const foto = await lerFotoDaSincronizacao(criarBanco(memoria.d1));
    expect(foto.estado).toMatchObject({ statusDaChave: "ausente", travaAte: null });
  });
});
