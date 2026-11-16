import {
  avisoDaChave,
  criarBanco,
  hojeNoFuso,
  INTERVALO_MINIMO_AO_ABRIR_SEGUNDOS,
  lerFotoDaSincronizacao,
  RESULTADOS_DA_ATUALIZACAO,
  type AvisoDaChave,
  type CodigoDeErro,
  type FotoDaSincronizacao,
  type ResultadoDaAtualizacao,
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
  /** Deixa um trabalho continuar depois de a resposta sair (`ctx.waitUntil` da Worker). */
  readonly aoFundo: (trabalho: Promise<unknown>) => void;
}

export type SituacaoDaConexao = "nao_configurada" | "indisponivel" | "nao_liberada" | "pronta";

/** Por que a importação não está andando: a chave, o conector (app) ou uma espera. */
export type ParadaDaImportacao = "chave" | "conector" | "espera";

export interface ProgressoDaImportacao {
  /** Os últimos 3 meses ainda não terminaram de chegar. */
  readonly emAndamento: boolean;
  /** Primeiro dia dos 3 meses. */
  readonly de: string | null;
  /** Último dia que a importação já alcançou (o mais atrasado entre os fluxos). */
  readonly ate: string | null;
  /** Se não está andando, por quê (qualquer coisa que pare a execução). */
  readonly parada: ParadaDaImportacao | null;
}

export interface PainelDaGarmin {
  readonly situacao: SituacaoDaConexao;
  readonly aviso: AvisoDaChave | null;
  /** Vencimento da chave informado pelo dono (`AAAA-MM-DD`), se houver. */
  readonly chaveVenceEm: string | null;
  /** Última vez que algo foi de fato buscado na Garmin. */
  readonly ultimaAtualizacaoEm: string | null;
  /** Última vez que a sincronização tentou, tenha dado certo ou não. */
  readonly ultimaTentativaEm: string | null;
  readonly importacao: ProgressoDaImportacao | null;
  /** Instante até o qual a Garmin pediu para esperar (só quando ainda vale). */
  readonly pausadaAte: string | null;
  readonly problema: CodigoDeErro | null;
  /** A ligação com a Worker `sync` existe (o botão e o pedido ao abrir dependem dela). */
  readonly ligada: boolean;
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
      chaveVenceEm: null,
      ultimaAtualizacaoEm: null,
      ultimaTentativaEm: null,
      importacao: null,
      pausadaAte: null,
      problema: null,
      ligada: false,
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

  const aviso = avisoDaChave(estado, hoje);
  const chaveParada =
    aviso !== null &&
    (aviso.tipo === "ausente" ||
      aviso.tipo === "mal_formada" ||
      aviso.tipo === "invalida" ||
      aviso.tipo === "venceu");
  const problema = estado?.erroCodigo ?? null;
  const paradaPor: ParadaDaImportacao | null = chaveParada
    ? "chave"
    : problema === "token_recusado"
      ? "conector"
      : pausadaAte !== null
        ? "espera"
        : null;
  const progresso = foto.progresso;
  const importacao: ProgressoDaImportacao | null =
    progresso.length === 0
      ? null
      : {
          emAndamento: progresso.some((p) => !p.historicoCompleto),
          de: progresso.map((p) => p.inicio).sort()[0] ?? null,
          ate: progresso
            .map((p) => p.importadoAte)
            .reduce<string | null>(
              (menor, data) =>
                data === null ? menor : menor === null || data < menor ? data : menor,
              null,
            ),
          parada: paradaPor,
        };

  // Trava mecânica da sync (POLITICA_REVISTA): sem liberação, o quadro diz só isso.
  if (problema === "nao_liberada") {
    return {
      situacao: "nao_liberada",
      aviso: null,
      chaveVenceEm: null,
      ultimaAtualizacaoEm: estado?.ultimoSucessoEm ?? null,
      ultimaTentativaEm: null,
      importacao: null,
      pausadaAte: null,
      problema,
      ligada: temSync,
      podeAtualizar: false,
    };
  }

  return {
    situacao: "pronta",
    aviso,
    chaveVenceEm: estado?.chaveVenceEm ?? null,
    ultimaAtualizacaoEm: estado?.ultimoSucessoEm ?? null,
    ultimaTentativaEm: estado?.ultimaExecucaoEm ?? null,
    importacao,
    pausadaAte,
    problema,
    ligada: temSync,
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

export { RESULTADOS_DA_ATUALIZACAO, type ResultadoDaAtualizacao };

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

/**
 * Ao abrir a área fechada, pede à `sync` uma sincronização, sem esperar o resultado (a página
 * não fica mais lenta). Só pede se faz mais de 10 minutos da última tentativa e a Garmin não
 * pediu para esperar; a `sync` confere de novo, então isto só poupa a viagem até ela.
 */
export function devePedirAoAbrir(painel: PainelDaGarmin, agora: Date): boolean {
  // "Não liberada" também pede: a sync confere de novo e o quadro sai desse estado sozinho
  // quando a trava for aberta.
  if (
    (painel.situacao !== "pronta" && painel.situacao !== "nao_liberada") ||
    !painel.ligada ||
    painel.pausadaAte !== null
  ) {
    return false;
  }
  if (painel.ultimaTentativaEm === null) return true;
  return (
    agora.getTime() - Date.parse(painel.ultimaTentativaEm) >=
    INTERVALO_MINIMO_AO_ABRIR_SEGUNDOS * 1000
  );
}

export function pedirAoAbrir(sync: Fetcher): Promise<void> {
  return sync.fetch("https://sync.interno/ao-abrir", { method: "POST" }).then(
    () => undefined,
    () => undefined,
  );
}

/** Aceita só os resultados conhecidos na URL (`?atualizacao=`); qualquer outra coisa é ignorada. */
export function resultadoDaUrl(valor: string | null): ResultadoDaAtualizacao | null {
  return RESULTADOS_DA_ATUALIZACAO.find((r) => r === valor) ?? null;
}
