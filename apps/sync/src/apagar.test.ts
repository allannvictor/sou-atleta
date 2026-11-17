import {
  criarBanco,
  gravarAtividade,
  gravarDiaSono,
  lerFotoGarantindoEstado,
  NOMES_DAS_TABELAS,
  tentarPegarTrava,
} from "@sou-atleta/db";
import { criarD1EmMemoria } from "@sou-atleta/db/teste";
import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "./index.js";
import { CHAVE_FALSA } from "./teste/ambiente.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const ctx = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

const pedir = (metodo = "POST") =>
  new Request("https://sync.interno/apagar-tudo", { method: metodo });

async function bancoComDados() {
  const memoria = criarD1EmMemoria();
  const banco = criarBanco(memoria.d1);
  await banco.batch([
    gravarAtividade(
      banco,
      {
        id: 7,
        dataLocal: "2026-11-01",
        inicioLocal: "2026-11-01 07:00:00",
        inicioGmt: "2026-11-01 10:00:00",
        tipo: "running",
        duracaoS: 3000,
        fcMedia: 151,
      },
      "2026-11-15T10:00:00.000Z",
    ),
    gravarDiaSono(banco, { data: "2026-11-01", sonoS: 25_200 }, "2026-11-15T10:00:00.000Z"),
  ]);
  return memoria;
}

const linhas = async (d1: D1Database, tabela: string) =>
  (await d1.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).first<{ n: number }>())?.n ?? -1;

describe("POST /apagar-tudo", () => {
  it("com a chave no cofre, recusa e não apaga nada", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const memoria = await bancoComDados();
    const resposta = await worker.fetch(
      pedir(),
      { DB: memoria.d1, GARMIN_API_KEY: CHAVE_FALSA },
      ctx,
    );
    expect(await resposta.json()).toEqual({ resultado: "chave_presente" });
    expect(await linhas(memoria.d1, "atividade")).toBe(1);
    expect(await linhas(memoria.d1, "dia_sono")).toBe(1);
  });

  it("com a chave ausente, apaga as tabelas todas", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const memoria = await bancoComDados();
    const resposta = await worker.fetch(pedir(), { DB: memoria.d1 }, ctx);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ resultado: "apagado" });
    for (const tabela of NOMES_DAS_TABELAS)
      expect(await linhas(memoria.d1, tabela), tabela).toBe(0);
  });

  it("com uma sincronização em andamento (trava viva), recusa e nada é apagado; passada a trava, apaga", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const memoria = await bancoComDados();
    const banco = criarBanco(memoria.d1);
    await lerFotoGarantindoEstado(banco, "2026-11-15T10:00:00.000Z");
    // Trava viva até 2099: uma execução (por exemplo, de versão antiga da Worker) ainda roda.
    await tentarPegarTrava(banco, "2026-11-15T10:00:00.000Z", "2099-01-01T00:00:00.000Z");

    const recusada = await worker.fetch(pedir(), { DB: memoria.d1 }, ctx);
    expect(await recusada.json()).toEqual({ resultado: "sincronizacao_em_andamento" });
    expect(await linhas(memoria.d1, "atividade")).toBe(1);
    expect(await linhas(memoria.d1, "dia_sono")).toBe(1);

    // Trava vencida (uma execução cortada não prende o apagar para sempre).
    memoria.executar("UPDATE sincronizacao_estado SET trava_ate = '2000-01-01T00:00:00.000Z'");
    const feita = await worker.fetch(pedir(), { DB: memoria.d1 }, ctx);
    expect(await feita.json()).toEqual({ resultado: "apagado" });
    expect(await linhas(memoria.d1, "atividade")).toBe(0);
  });

  it("segredo vazio ou só com espaços conta como chave ausente", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const memoria = await bancoComDados();
    const resposta = await worker.fetch(pedir(), { DB: memoria.d1, GARMIN_API_KEY: "   " }, ctx);
    expect(await resposta.json()).toEqual({ resultado: "apagado" });
  });

  it("só responde a POST: GET é 404 e nada é apagado", async () => {
    const memoria = await bancoComDados();
    const resposta = await worker.fetch(pedir("GET"), { DB: memoria.d1 }, ctx);
    expect(resposta.status).toBe(404);
    expect(await linhas(memoria.d1, "atividade")).toBe(1);
  });

  it("o log só leva a contagem de tabelas: nada de dado de saúde nem da chave", async () => {
    const saida: string[] = [];
    for (const metodo of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, metodo).mockImplementation((...args: unknown[]) => {
        saida.push(args.map(String).join(" "));
      });
    }
    const memoria = await bancoComDados();
    await worker.fetch(pedir(), { DB: memoria.d1, GARMIN_API_KEY: CHAVE_FALSA }, ctx);
    await worker.fetch(pedir(), { DB: memoria.d1 }, ctx);
    expect(saida.map((linha): unknown => JSON.parse(linha))).toEqual([
      { evento: "apagar_recusado_chave_presente" },
      { evento: "dados_apagados", tabelas: NOMES_DAS_TABELAS.length },
    ]);
    expect(saida.join("\n")).not.toContain(CHAVE_FALSA);
  });

  it("se o banco falhar, responde erro sem vazar a mensagem", async () => {
    const saida: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      saida.push(args.map(String).join(" "));
    });
    const d1 = {
      prepare: () => {
        throw new Error("segredo-no-erro-do-banco");
      },
      batch: () => Promise.reject(new Error("segredo-no-erro-do-banco")),
    } as unknown as D1Database;
    const resposta = await worker.fetch(pedir(), { DB: d1 }, ctx);
    expect(resposta.status).toBe(500);
    expect(await resposta.json()).toEqual({ resultado: "erro" });
    expect(saida.join("\n")).not.toContain("segredo-no-erro-do-banco");
    expect(saida.map((linha): unknown => JSON.parse(linha))).toEqual([{ evento: "erro_interno" }]);
  });
});
