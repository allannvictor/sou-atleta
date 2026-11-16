import { diasEntre, somarDias, type Dia } from "./datas.js";

/**
 * Variação da carga: a soma dos últimos 7 dias contra a média semanal das 6 semanas anteriores,
 * em %. Só mostra a variação; não prevê risco de lesão (a razão aguda/crônica é contestada:
 * Impellizzeri, F. M. et al. Acute:chronic workload ratio: conceptual issues and fundamental
 * pitfalls. International Journal of Sports Physiology and Performance 15(6):907-913, 2020).
 * Documento da métrica: docs/metricas/variacao-da-carga.md.
 */

export const DIAS_DA_SEMANA_ATUAL = 7;
export const SEMANAS_DE_COMPARACAO = 6;
const DIAS_NECESSARIOS = DIAS_DA_SEMANA_ATUAL * (1 + SEMANAS_DE_COMPARACAO);

export type VariacaoDaCarga =
  | {
      readonly tipo: "calculada";
      readonly cargaDaSemana: number;
      readonly mediaSemanalAnterior: number;
      readonly percentual: number;
    }
  /** Menos de 49 dias de dados: "Conhecendo você". */
  | { readonly tipo: "conhecendo"; readonly faltamDias: number }
  /** As 6 semanas anteriores não têm carga nenhuma: não existe comparação. */
  | { readonly tipo: "sem_comparacao"; readonly cargaDaSemana: number };

function somaDoTrecho(cargaPorDia: ReadonlyMap<Dia, number>, ate: Dia, dias: number): number {
  let soma = 0;
  for (let i = 0; i < dias; i += 1) soma += cargaPorDia.get(somarDias(ate, -i)) ?? 0;
  return soma;
}

export function variacaoDaCarga(
  cargaPorDia: ReadonlyMap<Dia, number>,
  desde: Dia,
  hoje: Dia,
): VariacaoDaCarga {
  const diasDeDados = diasEntre(desde, hoje) + 1;
  if (diasDeDados < DIAS_NECESSARIOS) {
    return { tipo: "conhecendo", faltamDias: Math.max(0, DIAS_NECESSARIOS - diasDeDados) };
  }
  const cargaDaSemana = somaDoTrecho(cargaPorDia, hoje, DIAS_DA_SEMANA_ATUAL);
  const anteriores = somaDoTrecho(
    cargaPorDia,
    somarDias(hoje, -DIAS_DA_SEMANA_ATUAL),
    DIAS_DA_SEMANA_ATUAL * SEMANAS_DE_COMPARACAO,
  );
  const mediaSemanalAnterior = anteriores / SEMANAS_DE_COMPARACAO;
  if (mediaSemanalAnterior <= 0) return { tipo: "sem_comparacao", cargaDaSemana };
  return {
    tipo: "calculada",
    cargaDaSemana,
    mediaSemanalAnterior,
    percentual: (cargaDaSemana / mediaSemanalAnterior - 1) * 100,
  };
}
