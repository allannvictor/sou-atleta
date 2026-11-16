import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import * as esquema from "./esquema.js";
import { criarD1EmMemoria } from "./teste/d1-em-memoria.js";

/** Nomes que jamais podem virar coluna: localização, identidade e credenciais (issue #5). */
const PROIBIDAS = [
  /latitude|(^|_)lat(_|$)/i,
  /longitude|(^|_)(lon|lng)(_|$)/i,
  /gps/i,
  /polyline|trajeto|rota\b/i,
  /^(?!data_local$|inicio_local$).*local/i, // nome do local; só `data_local` e `inicio_local` (hora local) valem
  /nome|name/i,
  /mail/i,
  /foto|image|avatar/i,
  /chave|token|key|senha|secret|autoriz/i,
  /owner|perfil_id|user_?id|conta/i,
];

/** Únicas colunas que citam a chave: guardam só o estado e a data de vencimento, nunca a chave. */
const SO_ESTADO_DA_CHAVE = new Set(["status_da_chave", "chave_vence_em"]);

describe("esquema do banco", () => {
  const d1 = criarD1EmMemoria();
  const colunasPorTabela = d1.colunas();

  it("tem as tabelas previstas e nenhuma a mais", () => {
    expect(Object.keys(colunasPorTabela).sort()).toEqual([
      "atividade",
      "dia_hrv",
      "dia_resumo",
      "dia_sono",
      "perfil_treino",
      "progresso_importacao",
      "sincronizacao_estado",
      "zona_fc",
    ]);
  });

  it("a migração cria as mesmas colunas que o esquema do Drizzle descreve", () => {
    const doEsquema: Record<string, string[]> = {};
    for (const valor of Object.values(esquema)) {
      try {
        const nome = getTableName(valor as never);
        doEsquema[nome] = Object.values(getTableColumns(valor as never)).map(
          (coluna) => (coluna as { name: string }).name,
        );
      } catch {
        // não é uma tabela (constantes e tipos)
      }
    }
    for (const [tabela, colunas] of Object.entries(doEsquema)) {
      expect([...(colunasPorTabela[tabela] ?? [])].sort(), tabela).toEqual([...colunas].sort());
    }
    expect(Object.keys(doEsquema).sort()).toEqual(Object.keys(colunasPorTabela).sort());
  });

  it("nenhuma coluna guarda GPS, local, nome, e-mail, foto, chave ou token", () => {
    for (const [tabela, colunas] of Object.entries(colunasPorTabela)) {
      for (const coluna of colunas) {
        if (SO_ESTADO_DA_CHAVE.has(coluna)) continue;
        for (const proibida of PROIBIDAS) {
          expect(coluna, `${tabela}.${coluna}`).not.toMatch(proibida);
        }
      }
    }
  });

  it("o banco recusa fonte diferente de garmin e origem de FC inventada", () => {
    const agora = "2026-11-15T10:00:00Z";
    const base = `1, 'x', '2026-01-01', '2026-01-01 10:00:00', '2026-01-01 13:00:00', 'running', 10`;
    expect(() => {
      d1.executar(
        `INSERT INTO atividade (id, fonte, data_local, inicio_local, inicio_gmt, tipo, duracao_s, atualizado_em) VALUES (${base}, '${agora}')`,
      );
    }).toThrow();
    expect(() => {
      d1.executar(
        `INSERT INTO atividade (id, fonte, fc_origem, data_local, inicio_local, inicio_gmt, tipo, duracao_s, atualizado_em) VALUES (2, 'garmin', 'braco', '2026-01-01', '2026-01-01 10:00:00', '2026-01-01 13:00:00', 'running', 10, '${agora}')`,
      );
    }).toThrow();
    expect(() => {
      d1.executar(
        `INSERT INTO atividade (id, fonte, data_local, inicio_local, inicio_gmt, tipo, duracao_s, atualizado_em) VALUES (3, 'garmin', '2026-01-01', '2026-01-01 10:00:00', '2026-01-01 13:00:00', 'running', 10, '${agora}')`,
      );
    }).not.toThrow();
  });
});
