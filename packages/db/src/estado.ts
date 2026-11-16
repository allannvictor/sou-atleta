import { and, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";

import type { Banco } from "./banco.js";
import {
  CODIGOS_DE_ERRO,
  FLUXOS,
  STATUS_DA_CHAVE,
  perfilTreino,
  progressoImportacao,
  sincronizacaoEstado,
  type CodigoDeErro,
  type Fluxo,
  type StatusDaChave,
} from "./esquema.js";

/**
 * Estado da sincronização: o que a Worker `sync` escreve e o que o site lê para avisar o atleta.
 * Nada aqui guarda a chave, o token nem texto livre de erro: só códigos curtos.
 */

export const DIAS_DE_AVISO_ANTES_DE_VENCER = 14;

export interface EstadoDaSincronizacao {
  readonly statusDaChave: StatusDaChave;
  readonly chaveVenceEm: string | null;
  readonly erroCodigo: CodigoDeErro | null;
  readonly ultimaExecucaoEm: string | null;
  readonly ultimoSucessoEm: string | null;
  readonly pausaAte: string | null;
  readonly falhasDeLimiteSeguidas: number;
  readonly travaAte: string | null;
}

export interface ProgressoDoFluxo {
  readonly fluxo: Fluxo;
  readonly inicio: string;
  readonly importadoAte: string | null;
  readonly historicoCompleto: boolean;
  readonly verificadoEm: string | null;
}

export interface PerfilResumido {
  readonly fusoHorario: string | null;
  readonly atualizadoEm: string;
}

export interface FotoDaSincronizacao {
  readonly estado: EstadoDaSincronizacao | null;
  readonly progresso: readonly ProgressoDoFluxo[];
  /** Fuso do atleta e quando o perfil foi buscado pela última vez; vazio antes da primeira busca. */
  readonly perfil: PerfilResumido | null;
}

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const linhaDeEstado = z.object({
  statusDaChave: z.enum(STATUS_DA_CHAVE),
  chaveVenceEm: dataIso.nullable(),
  // Código desconhecido (por exemplo de uma versão futura) vira "sem código", não derruba a tela.
  erroCodigo: z
    .string()
    .nullable()
    .transform((c) => CODIGOS_DE_ERRO.find((conhecido) => conhecido === c) ?? null),
  ultimaExecucaoEm: z.string().nullable(),
  ultimoSucessoEm: z.string().nullable(),
  pausaAte: z.string().nullable(),
  falhasDeLimiteSeguidas: z.number().int(),
  travaAte: z.string().nullable(),
});

const linhaDeProgresso = z.object({
  fluxo: z.enum(FLUXOS),
  inicio: dataIso,
  importadoAte: dataIso.nullable(),
  historicoCompleto: z.boolean(),
  verificadoEm: z.string().nullable(),
});

const linhaDePerfil = z.object({ fusoHorario: z.string().nullable(), atualizadoEm: z.string() });

/** Lê o estado, o progresso e o perfil numa única ida ao banco. */
export async function lerFotoDaSincronizacao(banco: Banco): Promise<FotoDaSincronizacao> {
  const [estados, progresso, perfis] = await banco.batch([
    banco.select().from(sincronizacaoEstado).where(eq(sincronizacaoEstado.id, 1)),
    banco.select().from(progressoImportacao),
    banco
      .select({ fusoHorario: perfilTreino.fusoHorario, atualizadoEm: perfilTreino.atualizadoEm })
      .from(perfilTreino),
  ]);
  const estado = estados[0];
  const perfil = perfis[0];
  return {
    estado: estado === undefined ? null : linhaDeEstado.parse(estado),
    progresso: progresso.map((linha) => linhaDeProgresso.parse(linha)),
    perfil: perfil === undefined ? null : linhaDePerfil.parse(perfil),
  };
}

/** Garante que a linha única do estado existe e lê tudo, numa única ida ao banco. */
export async function lerFotoGarantindoEstado(
  banco: Banco,
  agora: string,
): Promise<FotoDaSincronizacao> {
  const [, estados, progresso, perfis] = await banco.batch([
    banco
      .insert(sincronizacaoEstado)
      .values({ id: 1, atualizadoEm: agora })
      .onConflictDoNothing({ target: sincronizacaoEstado.id }),
    banco.select().from(sincronizacaoEstado).where(eq(sincronizacaoEstado.id, 1)),
    banco.select().from(progressoImportacao),
    banco
      .select({ fusoHorario: perfilTreino.fusoHorario, atualizadoEm: perfilTreino.atualizadoEm })
      .from(perfilTreino),
  ]);
  const estado = estados[0];
  const perfil = perfis[0];
  return {
    estado: estado === undefined ? null : linhaDeEstado.parse(estado),
    progresso: progresso.map((linha) => linhaDeProgresso.parse(linha)),
    perfil: perfil === undefined ? null : linhaDePerfil.parse(perfil),
  };
}

export interface ResultadoDaTrava {
  /** Falso quando outra execução está em andamento. */
  readonly obtida: boolean;
  /** Verdadeiro quando a execução anterior começou e nunca terminou (travou ou foi cortada). */
  readonly anteriorInterrompida: boolean;
}

/**
 * Pega a trava de execução. Ela impede cron e "Atualizar agora" de rodarem juntos e expira
 * sozinha, para uma execução cortada pelo limite de CPU não travar a sincronização para sempre.
 */
export async function tentarPegarTrava(
  banco: Banco,
  agora: string,
  travaAte: string,
): Promise<ResultadoDaTrava> {
  const [antes] = await banco
    .select({ travaAte: sincronizacaoEstado.travaAte })
    .from(sincronizacaoEstado)
    .where(eq(sincronizacaoEstado.id, 1));
  const [pegou] = await banco
    .update(sincronizacaoEstado)
    .set({ travaAte, atualizadoEm: agora })
    .where(
      and(
        eq(sincronizacaoEstado.id, 1),
        or(isNull(sincronizacaoEstado.travaAte), lt(sincronizacaoEstado.travaAte, agora)),
      ),
    )
    .returning({ id: sincronizacaoEstado.id });
  return {
    obtida: pegou !== undefined,
    anteriorInterrompida: pegou !== undefined && (antes?.travaAte ?? null) !== null,
  };
}

export interface FimDaExecucao {
  readonly statusDaChave: StatusDaChave;
  readonly chaveVenceEm: string | null;
  readonly erroCodigo: CodigoDeErro | null;
  readonly sucesso: boolean;
  /** Verdadeiro se a execução chegou a rodar (e não foi só uma consulta ao estado). */
  readonly executou: boolean;
  readonly pausaAte: string | null;
  readonly falhasDeLimiteSeguidas: number;
}

/** Libera a trava e grava como a execução terminou. */
export function registrarFimDaExecucao(banco: Banco, fim: FimDaExecucao, agora: string) {
  return banco
    .update(sincronizacaoEstado)
    .set({
      statusDaChave: fim.statusDaChave,
      chaveVenceEm: fim.chaveVenceEm,
      erroCodigo: fim.erroCodigo,
      pausaAte: fim.pausaAte,
      falhasDeLimiteSeguidas: fim.falhasDeLimiteSeguidas,
      travaAte: null,
      ...(fim.sucesso ? { ultimoSucessoEm: agora } : {}),
      ...(fim.executou ? { ultimaExecucaoEm: agora } : {}),
      atualizadoEm: agora,
    })
    .where(eq(sincronizacaoEstado.id, 1));
}

// ---------------------------------------------------------------------------------------------
// O que o atleta vê: avisos sobre a chave e sobre a importação.
// ---------------------------------------------------------------------------------------------

const MS_POR_DIA = 86_400_000;

/** Dias de calendário de `de` até `ate` (negativo se `ate` for antes). Datas `YYYY-MM-DD`. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / MS_POR_DIA);
}

/** A data de hoje (`YYYY-MM-DD`) no fuso do atleta, ou em UTC se o fuso for desconhecido ou inválido. */
export function hojeNoFuso(agoraMs: number, fuso: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: fuso ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(agoraMs));
  } catch {
    return new Date(agoraMs).toISOString().slice(0, 10);
  }
}

export type AvisoDaChave =
  | { readonly tipo: "ausente" }
  | { readonly tipo: "mal_formada" }
  | { readonly tipo: "sem_data" }
  | { readonly tipo: "invalida"; readonly expirou: boolean }
  | { readonly tipo: "vence"; readonly dias: number }
  | { readonly tipo: "venceu" };

/**
 * Qual aviso mostrar sobre a chave (issue #5):
 * - chave não cadastrada no cofre;
 * - a Garmin recusou a chave (expirou ou foi revogada);
 * - vence em 14 dias ou menos ("vence em N dias"); com 15 dias ou mais, nenhum aviso.
 *
 * `hoje` é uma data `YYYY-MM-DD` (no fuso que o chamador escolher). Sem estado (a sincronização
 * nunca rodou), não há o que avisar.
 */
export function avisoDaChave(
  estado: Pick<EstadoDaSincronizacao, "statusDaChave" | "chaveVenceEm"> | null,
  hoje: string,
): AvisoDaChave | null {
  if (estado === null) return null;
  const dias = estado.chaveVenceEm === null ? null : diasEntre(hoje, estado.chaveVenceEm);
  if (estado.statusDaChave === "ausente") return { tipo: "ausente" };
  if (estado.statusDaChave === "mal_formada") return { tipo: "mal_formada" };
  if (estado.statusDaChave === "invalida") {
    return { tipo: "invalida", expirou: dias !== null && dias < 0 };
  }
  if (estado.statusDaChave === "nao_verificada") return null;
  // Chave aceita, mas sem data de vencimento: sem a data, o aviso dos 14 dias não existe.
  if (dias === null) return { tipo: "sem_data" };
  if (dias < 0) return { tipo: "venceu" };
  if (dias <= DIAS_DE_AVISO_ANTES_DE_VENCER) return { tipo: "vence", dias };
  return null;
}

/**
 * Atualiza só o que o site mostra sobre a chave (estado e vencimento), sem mexer na trava nem no
 * resto. Usado quando a execução nem começa porque a chave não está no cofre.
 */
export function registrarEstadoDaChave(
  banco: Banco,
  estado: { readonly statusDaChave: StatusDaChave; readonly chaveVenceEm: string | null },
  agora: string,
) {
  return banco
    .update(sincronizacaoEstado)
    .set({ ...estado, atualizadoEm: agora })
    .where(eq(sincronizacaoEstado.id, 1));
}
