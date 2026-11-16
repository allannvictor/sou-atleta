import { and, desc, eq, isNotNull } from "drizzle-orm";

import type { Banco } from "./banco.js";
import {
  atividade,
  diaHrv,
  diaResumo,
  diaSono,
  perfilTreino,
  progressoImportacao,
  zonaFc,
  type Fluxo,
  type OrigemDeFc,
} from "./esquema.js";

/**
 * Montagem das gravações. Cada função devolve um comando que ainda não foi executado: quem chama
 * junta vários num `banco.batch([...])`, que no D1 é uma única ida ao banco e uma transação. É
 * assim que uma janela de dados e o avanço do progresso entram juntos ou não entram.
 *
 * Todas gravam com "inserir ou atualizar" pela chave natural (id da atividade, data do dia):
 * repetir uma importação nunca duplica linhas. `fonte` é sempre `garmin` neste conector.
 */

const FONTE = "garmin" as const;

/**
 * Sem `fcOrigem` nem `fcOrigemConferida`: a origem da FC (pulso ou cinta) é conferida à parte
 * (`gravarOrigemDeFc`) e uma reimportação da atividade nunca desfaz uma origem já conferida.
 */
export type NovaAtividade = Omit<
  typeof atividade.$inferInsert,
  "fonte" | "atualizadoEm" | "fcOrigem" | "fcOrigemConferida"
>;
export type NovoDiaHrv = Omit<typeof diaHrv.$inferInsert, "fonte" | "atualizadoEm">;
export type NovoDiaSono = Omit<typeof diaSono.$inferInsert, "fonte" | "atualizadoEm">;
export type NovoDiaResumo = Omit<
  typeof diaResumo.$inferInsert,
  "fonte" | "atualizadoEm" | "fcRepousoOrigem"
>;
export type NovaZonaFc = Omit<typeof zonaFc.$inferInsert, "fonte" | "atualizadoEm">;
export type NovoPerfil = Omit<typeof perfilTreino.$inferInsert, "fonte" | "atualizadoEm" | "id">;

export function gravarAtividade(banco: Banco, dados: NovaAtividade, agora: string) {
  return banco
    .insert(atividade)
    .values({ ...dados, fonte: FONTE, atualizadoEm: agora })
    .onConflictDoUpdate({
      target: atividade.id,
      set: { ...dados, fonte: FONTE, atualizadoEm: agora },
    });
}

export function gravarDiaHrv(banco: Banco, dados: NovoDiaHrv, agora: string) {
  return banco
    .insert(diaHrv)
    .values({ ...dados, fonte: FONTE, atualizadoEm: agora })
    .onConflictDoUpdate({ target: diaHrv.data, set: { ...dados, atualizadoEm: agora } });
}

export function gravarDiaSono(banco: Banco, dados: NovoDiaSono, agora: string) {
  return banco
    .insert(diaSono)
    .values({ ...dados, fonte: FONTE, atualizadoEm: agora })
    .onConflictDoUpdate({ target: diaSono.data, set: { ...dados, atualizadoEm: agora } });
}

export function gravarDiaResumo(banco: Banco, dados: NovoDiaResumo, agora: string) {
  return banco
    .insert(diaResumo)
    .values({ ...dados, fonte: FONTE, fcRepousoOrigem: "desconhecido", atualizadoEm: agora })
    .onConflictDoUpdate({ target: diaResumo.data, set: { ...dados, atualizadoEm: agora } });
}

export function gravarZonaFc(banco: Banco, dados: NovaZonaFc, agora: string) {
  return banco
    .insert(zonaFc)
    .values({ ...dados, fonte: FONTE, atualizadoEm: agora })
    .onConflictDoUpdate({ target: zonaFc.esporte, set: { ...dados, atualizadoEm: agora } });
}

export function gravarPerfil(banco: Banco, dados: NovoPerfil, agora: string) {
  return banco
    .insert(perfilTreino)
    .values({ ...dados, id: 1, fonte: FONTE, atualizadoEm: agora })
    .onConflictDoUpdate({ target: perfilTreino.id, set: { ...dados, atualizadoEm: agora } });
}

export function gravarOrigemDeFc(
  banco: Banco,
  atividadeId: number,
  origem: OrigemDeFc,
  agora: string,
) {
  return banco
    .update(atividade)
    .set({ fcOrigem: origem, fcOrigemConferida: true, atualizadoEm: agora })
    .where(eq(atividade.id, atividadeId));
}

/** Cria a linha de progresso de cada fluxo, sem mexer nas que já existem. */
export function iniciarProgresso(
  banco: Banco,
  fluxos: readonly Fluxo[],
  inicio: string,
  agora: string,
) {
  return fluxos.map((fluxo) =>
    banco
      .insert(progressoImportacao)
      .values({ fluxo, inicio, atualizadoEm: agora })
      .onConflictDoNothing({ target: progressoImportacao.fluxo }),
  );
}

export interface AvancoDeProgresso {
  readonly fluxo: Fluxo;
  readonly importadoAte: string;
  readonly historicoCompleto: boolean;
}

/** Marca até onde o fluxo foi importado. Vai no mesmo lote dos dados da janela. */
export function avancarProgresso(banco: Banco, avanco: AvancoDeProgresso, agora: string) {
  return banco
    .update(progressoImportacao)
    .set({
      importadoAte: avanco.importadoAte,
      historicoCompleto: avanco.historicoCompleto,
      verificadoEm: agora,
      atualizadoEm: agora,
    })
    .where(eq(progressoImportacao.fluxo, avanco.fluxo));
}

/** Um comando já montado, pronto para entrar num lote. */
export type ComandoDeLote = Parameters<Banco["batch"]>[0][number];

/**
 * Executa vários comandos numa única ida ao D1 e numa transação: ou tudo entra, ou nada. É assim
 * que uma janela de dados e o avanço do progresso andam juntos.
 */
export async function executarLote(
  banco: Banco,
  comandos: readonly ComandoDeLote[],
): Promise<void> {
  const [primeiro, ...resto] = comandos;
  if (primeiro === undefined) return;
  await banco.batch([primeiro, ...resto]);
}

/** Atividades com FC cuja origem (pulso ou cinta) ainda não foi conferida, das mais recentes. */
export async function listarAtividadesSemOrigemDeFc(
  banco: Banco,
  limite: number,
): Promise<number[]> {
  const linhas = await banco
    .select({ id: atividade.id })
    .from(atividade)
    .where(and(eq(atividade.fcOrigemConferida, false), isNotNull(atividade.fcMedia)))
    .orderBy(desc(atividade.dataLocal), desc(atividade.id))
    .limit(limite);
  return linhas.map((linha) => linha.id);
}
