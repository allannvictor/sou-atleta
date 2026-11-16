import { somarDias, type Dia } from "../corrida/datas.js";

/**
 * Seu normal: a faixa em que o seu próprio corpo costuma ficar. Para HRV, FC de repouso e sono,
 * é a média dos 30 dias anteriores a hoje, mais e menos um desvio padrão. Comparamos sempre com
 * o próprio atleta, nunca com valores de referência de outras pessoas (decisão 0003).
 * Fontes: Buchheit, M. Monitoring training status with HR measures: do all roads lead to Rome?
 * Frontiers in Physiology 5:73, 2014. Plews, D. J.; Laursen, P. B.; Kilding, A. E.; Buchheit, M.
 * Evaluating training adaptation with heart-rate measures: a methodological comparison.
 * International Journal of Sports Physiology and Performance 8(6):688-691, 2013.
 * Documento da métrica: docs/metricas/seu-normal.md.
 */

export const DIAS_DO_NORMAL = 30;
/** Menos que isto e o normal ainda não existe: "Conhecendo você" (decisão D2, issue #38). */
export const MINIMO_DE_DIAS_PARA_O_NORMAL = 21;
export const DIAS_DA_MEDIA_RECENTE = 7;
/**
 * Mínimo de medidas válidas dentro dos 7 dias para a média recente valer. A tese de Plews
 * (Auckland University of Technology) sugere ao menos 3 por semana em atletas treinados.
 */
export const MINIMO_NA_SEMANA = 3;

/** Medidas por dia (`AAAA-MM-DD`). Dia sem medida simplesmente não aparece: nunca vira zero. */
export type MedidasPorDia = ReadonlyMap<Dia, number>;

export type SeuNormal =
  | {
      readonly tipo: "calculado";
      readonly media: number;
      readonly desvioPadrao: number;
      /** Média menos um desvio padrão. */
      readonly minimo: number;
      /** Média mais um desvio padrão. */
      readonly maximo: number;
      readonly diasComMedida: number;
    }
  | { readonly tipo: "conhecendo"; readonly diasComMedida: number; readonly faltamDias: number };

export type PosicaoNoNormal = "abaixo" | "dentro" | "acima";

function medidaValida(valor: number | undefined): number | null {
  return valor !== undefined && Number.isFinite(valor) ? valor : null;
}

/** Medidas dos `dias` dias que terminam em `ate` (contando `ate`), do mais antigo ao mais novo. */
export function medidasDoTrecho(
  medidas: MedidasPorDia,
  ate: Dia,
  dias: number,
): readonly { readonly dia: Dia; readonly valor: number | null }[] {
  return Array.from({ length: dias }, (_, i) => {
    const dia = somarDias(ate, -(dias - 1 - i));
    return { dia, valor: medidaValida(medidas.get(dia)) };
  });
}

/**
 * O normal usa os 30 dias ANTERIORES a hoje (hoje fica de fora, para não se comparar consigo
 * mesmo). Desvio padrão amostral (n - 1).
 */
export function calcularSeuNormal(medidas: MedidasPorDia, hoje: Dia): SeuNormal {
  const valores = medidasDoTrecho(medidas, somarDias(hoje, -1), DIAS_DO_NORMAL)
    .map(({ valor }) => valor)
    .filter((valor): valor is number => valor !== null);
  if (valores.length < MINIMO_DE_DIAS_PARA_O_NORMAL) {
    return {
      tipo: "conhecendo",
      diasComMedida: valores.length,
      faltamDias: MINIMO_DE_DIAS_PARA_O_NORMAL - valores.length,
    };
  }
  const media = valores.reduce((soma, v) => soma + v, 0) / valores.length;
  const variancia = valores.reduce((soma, v) => soma + (v - media) ** 2, 0) / (valores.length - 1);
  const desvioPadrao = Math.sqrt(variancia);
  return {
    tipo: "calculado",
    media,
    desvioPadrao,
    minimo: media - desvioPadrao,
    maximo: media + desvioPadrao,
    diasComMedida: valores.length,
  };
}

export function posicaoNoNormal(
  valor: number,
  normal: Extract<SeuNormal, { tipo: "calculado" }>,
): PosicaoNoNormal {
  if (valor < normal.minimo) return "abaixo";
  if (valor > normal.maximo) return "acima";
  return "dentro";
}

/**
 * Média dos últimos 7 dias (contando hoje), só com pelo menos 3 medidas válidas. Plews e
 * colegas (2013) mostram que a média de uma semana representa melhor que um dia isolado.
 */
export function mediaDosUltimosDias(medidas: MedidasPorDia, hoje: Dia): number | null {
  const valores = medidasDoTrecho(medidas, hoje, DIAS_DA_MEDIA_RECENTE)
    .map(({ valor }) => valor)
    .filter((valor): valor is number => valor !== null);
  if (valores.length < MINIMO_NA_SEMANA) return null;
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

/** Valor de hoje, ou `null` se o relógio não mediu. */
export function medidaDeHoje(medidas: MedidasPorDia, hoje: Dia): number | null {
  return medidaValida(medidas.get(hoje));
}
