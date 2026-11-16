import { diasEntre, somarDias, type Dia } from "./datas.js";

/**
 * Base (CTL), Carga recente (ATL) e Saldo (TSB): médias móveis exponenciais da carga diária, de
 * 42 e 7 dias, e a diferença entre elas. Modelo de impulso e resposta de Banister (1975), na
 * forma usada por Coggan (Performance Manager Chart).
 *   Calvert, T. W.; Banister, E. W.; Savage, M. V.; Bach, T. A systems model of the effects of
 *   training on physical performance. IEEE Transactions on Systems, Man, and Cybernetics
 *   SMC-6(2):94-102, 1976.
 *   Allen, H.; Coggan, A. Training and Racing with a Power Meter. 2. ed. VeloPress, 2010.
 * Documento da métrica: docs/metricas/base-carga-recente-saldo.md.
 */

export const DIAS_DA_BASE = 42;
export const DIAS_DA_CARGA_RECENTE = 7;

export interface DiaDaForma {
  readonly dia: Dia;
  readonly carga: number;
  /** Base ao fim deste dia (inclui o treino do dia). */
  readonly base: number;
  /** Carga recente ao fim deste dia. */
  readonly cargaRecente: number;
  /** Saldo ao chegar neste dia: Base menos Carga recente do fim do dia anterior (decisão D4). */
  readonly saldo: number;
}

export interface Forma {
  readonly dias: readonly DiaDaForma[];
  /** Dias entre o começo dos dados e hoje, contando os dois. */
  readonly diasDeDados: number;
  /** Com menos de 42 dias de dados a Base ainda está se formando ("Conhecendo você"). */
  readonly baseFormada: boolean;
  readonly faltamParaABase: number;
}

function mediaDosPrimeiros(cargas: readonly number[], quantos: number): number {
  const trecho = cargas.slice(0, quantos);
  return trecho.reduce((soma, c) => soma + c, 0) / trecho.length;
}

/**
 * Calcula a forma de `desde` até `hoje`. Dia sem treino vale zero. Decisão D3: o valor de
 * partida é a média da carga diária das primeiras 6 semanas (Base) e da primeira semana (Carga
 * recente); partir de zero subestimaria a Base por semanas.
 * Devolve `null` se `desde` vem depois de `hoje`.
 */
export function calcularForma(
  cargaPorDia: ReadonlyMap<Dia, number>,
  desde: Dia,
  hoje: Dia,
): Forma | null {
  const diasDeDados = diasEntre(desde, hoje) + 1;
  if (diasDeDados < 1) return null;

  const cargas = Array.from({ length: diasDeDados }, (_, i) =>
    Math.max(0, cargaPorDia.get(somarDias(desde, i)) ?? 0),
  );
  let base = mediaDosPrimeiros(cargas, DIAS_DA_BASE);
  let cargaRecente = mediaDosPrimeiros(cargas, DIAS_DA_CARGA_RECENTE);

  const dias = cargas.map((carga, i): DiaDaForma => {
    const saldo = base - cargaRecente;
    base += (carga - base) / DIAS_DA_BASE;
    cargaRecente += (carga - cargaRecente) / DIAS_DA_CARGA_RECENTE;
    return { dia: somarDias(desde, i), carga, base, cargaRecente, saldo };
  });

  return {
    dias,
    diasDeDados,
    baseFormada: diasDeDados >= DIAS_DA_BASE,
    faltamParaABase: Math.max(0, DIAS_DA_BASE - diasDeDados),
  };
}

/** Variação percentual de `atual` contra `antes`; `null` quando `antes` é zero. */
export function variacaoPercentual(atual: number, antes: number): number | null {
  return antes > 0 ? (atual / antes - 1) * 100 : null;
}
