import { diasEntre, inicioDaSemana, somarDias, type Dia } from "./datas.js";

/**
 * Volume e consistência por semana de calendário (segunda a domingo): km de corrida, tempo e
 * número de treinos. Decisão D6: só os km de corrida entram na soma de km (somar pedal com
 * corrida confunde); tempo e treinos contam todas as modalidades.
 * Documento da métrica: docs/metricas/volume-e-consistencia.md.
 */

export const SEMANAS_COMPLETAS = 8;
const SEMANAS_DA_TENDENCIA = 4;

export interface AtividadeDeVolume {
  readonly dataLocal: Dia;
  readonly tipo: string;
  readonly duracaoS: number;
  readonly distanciaM: number | null;
}

export interface SemanaDeVolume {
  readonly inicio: Dia;
  /** A semana de hoje: ainda não terminou, então não entra na tendência. */
  readonly emAndamento: boolean;
  readonly kmDeCorrida: number;
  readonly tempoS: number;
  readonly treinos: number;
}

/** Variação (%) da média das 4 semanas completas mais recentes contra as 4 anteriores. */
export interface TendenciaDoVolume {
  readonly kmDeCorrida: number | null;
  readonly tempoS: number | null;
  readonly treinos: number | null;
}

export interface VolumeSemanal {
  /** Da mais antiga para a de hoje: 8 semanas completas e a semana em andamento. */
  readonly semanas: readonly SemanaDeVolume[];
  /** `null` enquanto faltam semanas de dados ("Conhecendo você"). */
  readonly tendencia: TendenciaDoVolume | null;
}

/** Corrida de rua, esteira, trilha, pista e variações (`running`, `treadmill_running`, `*_run`). */
export function ehCorrida(tipo: string): boolean {
  return /running|(^|_)run($|_)/i.test(tipo);
}

function media(semanas: readonly SemanaDeVolume[], campo: keyof SemanaDeVolume): number {
  return semanas.reduce((soma, s) => soma + Number(s[campo]), 0) / semanas.length;
}

function variacao(recentes: number, anteriores: number): number | null {
  return anteriores > 0 ? (recentes / anteriores - 1) * 100 : null;
}

export function volumeSemanal(
  atividades: readonly AtividadeDeVolume[],
  desde: Dia,
  hoje: Dia,
): VolumeSemanal {
  const semanaDeHoje = inicioDaSemana(hoje);
  const primeiraSemana = somarDias(semanaDeHoje, -7 * SEMANAS_COMPLETAS);
  const semanas: SemanaDeVolume[] = Array.from({ length: SEMANAS_COMPLETAS + 1 }, (_, i) => {
    const inicio = somarDias(primeiraSemana, 7 * i);
    const fim = somarDias(inicio, 6);
    const daSemana = atividades.filter((a) => a.dataLocal >= inicio && a.dataLocal <= fim);
    return {
      inicio,
      emAndamento: inicio === semanaDeHoje,
      kmDeCorrida:
        daSemana
          .filter((a) => ehCorrida(a.tipo))
          .reduce((soma, a) => soma + Math.max(0, a.distanciaM ?? 0), 0) / 1000,
      tempoS: daSemana.reduce((soma, a) => soma + Math.max(0, a.duracaoS), 0),
      treinos: daSemana.length,
    };
  });

  // A tendência só existe se os dados cobrem as 8 semanas completas.
  if (diasEntre(desde, primeiraSemana) < 0) return { semanas, tendencia: null };
  const completas = semanas.filter((s) => !s.emAndamento);
  const recentes = completas.slice(-SEMANAS_DA_TENDENCIA);
  const anteriores = completas.slice(0, SEMANAS_DA_TENDENCIA);
  return {
    semanas,
    tendencia: {
      kmDeCorrida: variacao(media(recentes, "kmDeCorrida"), media(anteriores, "kmDeCorrida")),
      tempoS: variacao(media(recentes, "tempoS"), media(anteriores, "tempoS")),
      treinos: variacao(media(recentes, "treinos"), media(anteriores, "treinos")),
    },
  };
}
