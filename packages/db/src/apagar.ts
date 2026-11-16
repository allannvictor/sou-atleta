import type { Banco } from "./banco.js";
import {
  atividade,
  diaHrv,
  diaResumo,
  diaSono,
  perfilTreino,
  progressoImportacao,
  sincronizacaoEstado,
  zonaFc,
} from "./esquema.js";
import { executarLote } from "./gravacao.js";

/**
 * "Apagar minha conta" (issue #22): tudo o que o app guardou no banco, de uma vez. Um teste
 * compara esta lista com as tabelas criadas pelas migrações e falha se uma tabela nova ficar
 * de fora: dado novo precisa nascer apagável.
 */
const TABELAS = [
  ["atividade", atividade],
  ["dia_hrv", diaHrv],
  ["dia_resumo", diaResumo],
  ["dia_sono", diaSono],
  ["zona_fc", zonaFc],
  ["perfil_treino", perfilTreino],
  ["progresso_importacao", progressoImportacao],
  ["sincronizacao_estado", sincronizacaoEstado],
] as const;

export const NOMES_DAS_TABELAS: readonly string[] = TABELAS.map(([nome]) => nome);

/** Resposta da Worker `sync` ao pedido de apagar tudo, em palavras que o site sabe mostrar. */
export const RESULTADOS_DO_APAGAR = [
  "apagado",
  "chave_presente",
  "nao_configurada",
  "erro",
] as const;
export type ResultadoDoApagar = (typeof RESULTADOS_DO_APAGAR)[number];

/** Apaga todas as tabelas numa transação só: ou apaga tudo, ou nada. */
export async function apagarTudo(banco: Banco): Promise<void> {
  await executarLote(
    banco,
    TABELAS.map(([, tabela]) => banco.delete(tabela)),
  );
}
