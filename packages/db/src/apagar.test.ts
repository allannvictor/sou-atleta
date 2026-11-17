import { describe, expect, it } from "vitest";

import { apagarTudo, NOMES_DAS_TABELAS } from "./apagar.js";
import { criarBanco } from "./banco.js";
import { lerFotoGarantindoEstado } from "./estado.js";
import {
  gravarAtividade,
  gravarDiaHrv,
  gravarDiaResumo,
  gravarDiaSono,
  gravarPerfil,
  gravarZonaFc,
  iniciarProgresso,
} from "./gravacao.js";
import { criarD1EmMemoria } from "./teste/d1-em-memoria.js";

const AGORA = "2026-11-15T10:00:00.000Z";

async function linhasPorTabela(d1: D1Database): Promise<Record<string, number>> {
  const contagens: Record<string, number> = {};
  for (const nome of NOMES_DAS_TABELAS) {
    const linha = await d1.prepare(`SELECT COUNT(*) AS n FROM ${nome}`).first<{ n: number }>();
    contagens[nome] = linha?.n ?? -1;
  }
  return contagens;
}

describe("apagar tudo", () => {
  it("a lista cobre exatamente as tabelas das migrações (tabela nova precisa nascer apagável)", () => {
    const memoria = criarD1EmMemoria();
    expect([...NOMES_DAS_TABELAS].sort()).toEqual(Object.keys(memoria.colunas()).sort());
  });

  it("depois de apagar, todas as tabelas estão vazias e nada de dado sobra no despejo", async () => {
    const memoria = criarD1EmMemoria();
    const banco = criarBanco(memoria.d1);
    await banco.batch([
      gravarAtividade(
        banco,
        {
          id: 1,
          dataLocal: "2026-11-01",
          inicioLocal: "2026-11-01 07:00:00",
          inicioGmt: "2026-11-01 10:00:00",
          tipo: "running",
          duracaoS: 3000,
          fcMedia: 151,
        },
        AGORA,
      ),
      gravarDiaHrv(banco, { data: "2026-11-01", hrvNoiteMs: 55 }, AGORA),
      gravarDiaResumo(banco, { data: "2026-11-01", fcRepouso: 49 }, AGORA),
      gravarDiaSono(banco, { data: "2026-11-01", sonoS: 25_200 }, AGORA),
      gravarZonaFc(
        banco,
        {
          esporte: "DEFAULT",
          zona1Piso: 100,
          zona2Piso: 120,
          zona3Piso: 140,
          zona4Piso: 160,
          zona5Piso: 175,
        },
        AGORA,
      ),
      gravarPerfil(banco, { fusoHorario: "America/Sao_Paulo" }, AGORA),
      ...iniciarProgresso(banco, ["atividades", "sono"], "2026-08-17", AGORA),
    ]);
    await lerFotoGarantindoEstado(banco, AGORA); // cria a linha de estado da sincronização

    const antes = await linhasPorTabela(memoria.d1);
    for (const nome of NOMES_DAS_TABELAS) expect(antes[nome], nome).toBeGreaterThan(0);

    await apagarTudo(banco);

    const depois = await linhasPorTabela(memoria.d1);
    for (const nome of NOMES_DAS_TABELAS) expect(depois[nome], nome).toBe(0);
    expect(memoria.despejo()).not.toContain("America/Sao_Paulo");
    expect(memoria.despejo()).not.toContain("2026-11-01");
  });

  it("apagar com o banco vazio não dá erro", async () => {
    const banco = criarBanco(criarD1EmMemoria().d1);
    await expect(apagarTudo(banco)).resolves.toBeUndefined();
  });
});
