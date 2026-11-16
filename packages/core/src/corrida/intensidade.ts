import { somarDias, type Dia } from "./datas.js";
import type { TemposPorZona } from "./carga.js";

/**
 * Distribuição de intensidade: que parte do tempo dos últimos 28 dias foi em cada zona de FC.
 * Só entram atividades com tempo em zona informado pela Garmin, de todas as modalidades.
 * Documento da métrica: docs/metricas/distribuicao-de-intensidade.md.
 */

export const DIAS_DA_DISTRIBUICAO = 28;

export interface AtividadeDeIntensidade {
  readonly dataLocal: Dia;
  readonly temposPorZonaS: TemposPorZona;
}

export interface DistribuicaoDeIntensidade {
  readonly segundosPorZona: readonly [number, number, number, number, number];
  /** Percentual de cada zona; soma 100. */
  readonly percentualPorZona: readonly [number, number, number, number, number];
  readonly totalS: number;
  readonly atividadesConsideradas: number;
}

export function distribuicaoDeIntensidade(
  atividades: readonly AtividadeDeIntensidade[],
  hoje: Dia,
): DistribuicaoDeIntensidade | null {
  const inicio = somarDias(hoje, -(DIAS_DA_DISTRIBUICAO - 1));
  const segundos: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let consideradas = 0;
  for (const atividade of atividades) {
    if (atividade.dataLocal < inicio || atividade.dataLocal > hoje) continue;
    const tempos = atividade.temposPorZonaS.map((t) =>
      t !== null && Number.isFinite(t) && t > 0 ? t : 0,
    );
    if (tempos.every((t) => t === 0)) continue;
    consideradas += 1;
    tempos.forEach((t, i) => {
      segundos[i] = (segundos[i] ?? 0) + t;
    });
  }
  const total = segundos.reduce((soma, s) => soma + s, 0);
  if (total <= 0) return null;
  const [a, b, c, d, e] = segundos;
  const porcento = (s: number) => (s / total) * 100;
  return {
    segundosPorZona: segundos,
    percentualPorZona: [porcento(a), porcento(b), porcento(c), porcento(d), porcento(e)],
    totalS: total,
    atividadesConsideradas: consideradas,
  };
}
