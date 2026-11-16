import {
  calcularForma,
  cargaDoTreino,
  cargaPorDia,
  distribuicaoDeIntensidade,
  ehCorrida,
  treinosQueMaisPesaram,
  treinosSemFc,
  variacaoDaCarga,
  variacaoPercentual,
  volumeSemanal,
  type AtividadeDeCarga,
  type PisosDeZona,
  type TreinoComCarga,
} from "@sou-atleta/core";
import {
  avisoDaCarga,
  conhecendoVoce,
  EXPLICACOES,
  fraseDaBase,
  fraseDaCargaRecente,
  fraseDaDistribuicao,
  fraseDaSemana,
  fraseDaVariacao,
  fraseDoSaldo,
  fraseDosTreinosFora,
  fraseDoTreino,
  frasesDaTendenciaDoVolume,
  diaEMes,
} from "@sou-atleta/narrative";
import {
  criarBanco,
  hojeNoFuso,
  lerDadosDoMomentoAtual,
  type DadosDoMomentoAtual,
} from "@sou-atleta/db";

import type { LigacoesDaGarmin } from "./garmin";

/**
 * "Momento atual" da área fechada (issues #37 e #38): transforma o que a Worker `sync` guardou
 * em números (`core`) e frases (`narrative`). Só LÊ o banco. Sem dado, a tela diz isso; nunca
 * inventa número. O app funciona 100% sem IA (0004).
 */

const FUSO_PADRAO = "America/Sao_Paulo";

export interface CartaoDaForma {
  readonly nome: string;
  readonly valor: string;
  readonly explicacao: string;
  readonly frase: string;
}

export interface TreinoCitado {
  readonly texto: string;
  readonly aviso: string | null;
}

export interface SemanaMostrada {
  readonly rotulo: string;
  readonly frase: string;
}

export interface IntensidadeMostrada {
  readonly frase: string;
  readonly zonas: readonly { readonly zona: number; readonly percentual: number }[];
}

export type MomentoAtual =
  | { readonly situacao: "indisponivel" }
  | { readonly situacao: "sem_atividades"; readonly importacaoEmAndamento: boolean }
  | {
      readonly situacao: "pronto";
      readonly importacaoEmAndamento: boolean;
      readonly avisoDaImportacao: string | null;
      /** "Conhecendo você" da Base, quando ela ainda se forma. */
      readonly conhecendoABase: string | null;
      readonly explicacaoDaCarga: string;
      readonly cartoes: readonly CartaoDaForma[];
      readonly porQueMudou: readonly TreinoCitado[];
      readonly treinosFora: string | null;
      readonly variacao: string;
      readonly semanas: readonly SemanaMostrada[];
      readonly tendenciaDoVolume: readonly string[];
      readonly conhecendoOVolume: string | null;
      readonly intensidade: IntensidadeMostrada | null;
    };

/** Pisos da zona de FC do esporte da atividade, ou os padrão da Garmin quando não há. */
function pisosDaAtividade(tipo: string, zonas: DadosDoMomentoAtual["zonas"]): PisosDeZona | null {
  const candidatos = [
    tipo.toUpperCase(),
    ...(ehCorrida(tipo) ? ["RUNNING"] : []),
    ...(/cycl|bik/i.test(tipo) ? ["CYCLING"] : []),
    "DEFAULT",
  ];
  for (const esporte of candidatos) {
    const achada = zonas.find((z) => z.esporte === esporte);
    if (achada !== undefined) return achada.pisos;
  }
  return null;
}

/** Pura, para testar sem banco: a mesma entrada dá sempre a mesma tela. */
export function montarMomentoAtual(dados: DadosDoMomentoAtual, agora: Date): MomentoAtual {
  const desde = dados.inicioDasAtividades;
  if (desde === null || dados.atividades.length === 0) {
    return { situacao: "sem_atividades", importacaoEmAndamento: dados.importacaoEmAndamento };
  }
  const hoje = hojeNoFuso(agora.getTime(), dados.fusoHorario ?? FUSO_PADRAO);

  const treinos: TreinoComCarga[] = dados.atividades.map((a) => {
    const atividade: AtividadeDeCarga = {
      id: a.id,
      dataLocal: a.dataLocal,
      tipo: a.tipo,
      duracaoS: a.duracaoS,
      fcMedia: a.fcMedia,
      fcOrigem: a.fcOrigem,
      temposPorZonaS: a.temposPorZonaS,
    };
    return { atividade, carga: cargaDoTreino(atividade, pisosDaAtividade(a.tipo, dados.zonas)) };
  });
  const porDia = cargaPorDia(treinos);
  const forma = calcularForma(porDia, desde, hoje);
  if (forma === null) {
    return { situacao: "sem_atividades", importacaoEmAndamento: dados.importacaoEmAndamento };
  }

  const dias = forma.dias;
  const agoraDia = dias[dias.length - 1];
  const semanaPassada = dias[dias.length - 8];
  if (agoraDia === undefined) {
    return { situacao: "sem_atividades", importacaoEmAndamento: dados.importacaoEmAndamento };
  }
  const contra = (atual: number, antes: number | undefined) =>
    antes === undefined ? null : variacaoPercentual(atual, antes);

  const cartoes: CartaoDaForma[] = [
    {
      nome: "Base",
      valor: String(Math.round(agoraDia.base)),
      explicacao: EXPLICACOES.base,
      frase: fraseDaBase(agoraDia.base, contra(agoraDia.base, semanaPassada?.base)),
    },
    {
      nome: "Carga recente",
      valor: String(Math.round(agoraDia.cargaRecente)),
      explicacao: EXPLICACOES.cargaRecente,
      frase: fraseDaCargaRecente(
        agoraDia.cargaRecente,
        contra(agoraDia.cargaRecente, semanaPassada?.cargaRecente),
      ),
    },
    {
      nome: "Saldo",
      valor: String(Math.round(agoraDia.saldo)),
      explicacao: EXPLICACOES.saldo,
      frase: fraseDoSaldo(agoraDia.saldo),
    },
  ];

  const volume = volumeSemanal(dados.atividades, desde, hoje);
  const intensidade = distribuicaoDeIntensidade(dados.atividades, hoje);

  return {
    situacao: "pronto",
    importacaoEmAndamento: dados.importacaoEmAndamento,
    avisoDaImportacao: dados.importacaoEmAndamento ? EXPLICACOES.importacaoEmAndamento : null,
    conhecendoABase: forma.baseFormada
      ? null
      : conhecendoVoce(forma.faltamParaABase, "para sua Base ficar completa"),
    explicacaoDaCarga: EXPLICACOES.carga,
    cartoes,
    porQueMudou: treinosQueMaisPesaram(treinos, hoje).map(({ atividade, carga }) => ({
      texto: fraseDoTreino({
        dataLocal: atividade.dataLocal,
        tipo: atividade.tipo,
        duracaoS: atividade.duracaoS,
        carga,
      }),
      aviso: carga.tipo === "calculada" && carga.aviso !== null ? avisoDaCarga(carga.aviso) : null,
    })),
    treinosFora: fraseDosTreinosFora(treinosSemFc(treinos, hoje)),
    variacao: fraseDaVariacao(variacaoDaCarga(porDia, desde, hoje)),
    semanas: volume.semanas
      .map((semana) => ({
        rotulo: `Semana de ${diaEMes(semana.inicio)}${semana.emAndamento ? " (em andamento)" : ""}`,
        frase: fraseDaSemana(semana),
      }))
      .reverse(),
    tendenciaDoVolume: volume.tendencia === null ? [] : frasesDaTendenciaDoVolume(volume.tendencia),
    conhecendoOVolume:
      volume.tendencia === null
        ? "Conhecendo você: a tendência aparece depois de 8 semanas de dados."
        : null,
    intensidade:
      intensidade === null
        ? null
        : {
            frase: fraseDaDistribuicao(intensidade),
            zonas: intensidade.percentualPorZona.map((percentual, i) => ({
              zona: i + 1,
              percentual,
            })),
          },
  };
}

/** Lê o banco e monta a tela. Nunca lança: sem banco ou com erro, a tela diz que não dá. */
export async function lerMomentoAtual(
  ligacoes: LigacoesDaGarmin,
  agora: Date,
): Promise<MomentoAtual> {
  if (ligacoes.banco === undefined) return { situacao: "indisponivel" };
  try {
    return montarMomentoAtual(await lerDadosDoMomentoAtual(criarBanco(ligacoes.banco)), agora);
  } catch {
    // Por exemplo, a migração do banco ainda não foi aplicada. Nada do erro vai para a tela.
    return { situacao: "indisponivel" };
  }
}
