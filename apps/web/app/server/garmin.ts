import {
  avisoDaChave,
  criarBanco,
  hojeNoFuso,
  lerFotoDaSincronizacao,
  type AvisoDaChave,
  type CodigoDeErro,
  type FotoDaSincronizacao,
} from "@sou-atleta/db";
import { z } from "zod";

/**
 * O que a área fechada mostra sobre a conexão com a Garmin (issue #5) e como pede uma
 * atualização. Este arquivo só LÊ o estado que a Worker `sync` grava e conversa com ela por
 * ligação interna: a chave da Garmin nunca passa por aqui.
 */

/** O que a Worker do site recebe para falar com a Garmin. */
export interface LigacoesDaGarmin {
  readonly banco: D1Database | undefined;
  readonly sync: Fetcher | undefined;
}

export type SituacaoDaConexao = "nao_configurada" | "indisponivel" | "pronta";

export interface ProgressoDaImportacao {
  readonly emAndamento: boolean;
  /** Último dia que a importação do histórico já alcançou (o mais atrasado entre os fluxos). */
  readonly ate: string | null;
}

export interface PainelDaGarmin {
  readonly situacao: SituacaoDaConexao;
  readonly aviso: AvisoDaChave | null;
  readonly ultimaAtualizacaoEm: string | null;
  readonly importacao: ProgressoDaImportacao | null;
  /** Instante até o qual a Garmin pediu para esperar (só quando ainda vale). */
  readonly pausadaAte: string | null;
  readonly problema: CodigoDeErro | null;
  readonly podeAtualizar: boolean;
}

const FUSO_PADRAO = "America/Sao_Paulo";

/** Transforma o que está no banco no que a tela mostra. Pura, para testar sem banco. */
export function montarPainel(
  foto: FotoDaSincronizacao | null,
  agora: Date,
  temSync: boolean,
): PainelDaGarmin {
  if (foto === null) {
    return {
      situacao: "nao_configurada",
      aviso: null,
      ultimaAtualizacaoEm: null,
      importacao: null,
      pausadaAte: null,
      problema: null,
      podeAtualizar: false,
    };
  }
  const fuso = foto.perfil?.fusoHorario ?? FUSO_PADRAO;
  const hoje = hojeNoFuso(agora.getTime(), fuso);
  const estado = foto.estado;
  const pausadaAte =
    estado?.pausaAte !== null &&
    estado?.pausaAte !== undefined &&
    estado.pausaAte > agora.toISOString()
      ? estado.pausaAte
      : null;

  const progresso = foto.progresso;
  const importacao: ProgressoDaImportacao | null =
    progresso.length === 0
      ? null
      : {
          emAndamento: progresso.some((p) => !p.historicoCompleto),
          ate: progresso
            .map((p) => p.importadoAte)
            .reduce<string | null>(
              (menor, data) =>
                data === null ? menor : menor === null || data < menor ? data : menor,
              null,
            ),
        };

  return {
    situacao: "pronta",
    aviso: avisoDaChave(estado, hoje),
    ultimaAtualizacaoEm: estado?.ultimoSucessoEm ?? null,
    importacao,
    pausadaAte,
    problema: estado?.erroCodigo ?? null,
    podeAtualizar: temSync,
  };
}

/** Lê o estado da sincronização. Nunca lança: sem banco ou com erro, a tela diz o que dá. */
export async function lerPainel(ligacoes: LigacoesDaGarmin, agora: Date): Promise<PainelDaGarmin> {
  if (ligacoes.banco === undefined) return montarPainel(null, agora, false);
  try {
    const foto = await lerFotoDaSincronizacao(criarBanco(ligacoes.banco));
    return montarPainel(foto, agora, ligacoes.sync !== undefined);
  } catch {
    // Por exemplo, a migração do banco ainda não foi aplicada. Nada do erro vai para a tela.
    return { ...montarPainel(null, agora, false), situacao: "indisponivel" };
  }
}

export const RESULTADOS_DA_ATUALIZACAO = [
  "iniciada",
  "muito_cedo",
  "pausada",
  "ja_em_andamento",
  "sem_chave",
  "nao_configurada",
  "erro",
] as const;
export type ResultadoDaAtualizacao = (typeof RESULTADOS_DA_ATUALIZACAO)[number];

const respostaDaSync = z.object({ resultado: z.enum(RESULTADOS_DA_ATUALIZACAO) });

/** Pede à Worker `sync` que atualize agora. Só a ligação interna chega lá. */
export async function pedirAtualizacao(sync: Fetcher | undefined): Promise<ResultadoDaAtualizacao> {
  if (sync === undefined) return "nao_configurada";
  try {
    const resposta = await sync.fetch("https://sync.interno/atualizar", { method: "POST" });
    const corpo = respostaDaSync.safeParse(await resposta.json());
    return corpo.success ? corpo.data.resultado : "erro";
  } catch {
    return "erro";
  }
}

/** Aceita só os resultados conhecidos na URL (`?atualizacao=`); qualquer outra coisa é ignorada. */
export function resultadoDaUrl(valor: string | null): ResultadoDaAtualizacao | null {
  return RESULTADOS_DA_ATUALIZACAO.find((r) => r === valor) ?? null;
}
