import { diasEntre, somarDias, type Dia } from "./datas.js";

/**
 * Carga do treino: TRIMP por zonas de Edwards. Cada minuto numa zona de FC vale o número da
 * zona (1 a 5) e a carga é a soma. Edwards definiu as zonas por faixas da FC máxima; usamos as
 * zonas da própria Garmin (decisão 0003), para o número bater com o que o atleta vê no relógio.
 * Fonte: Edwards, S. The Heart Rate Monitor Book. Fleet Feet Press (1992 ou 1993, conforme a fonte).
 * Os pesos 1 a 5 são os citados na literatura; conferir no livro (ver o documento da métrica).
 * Documento da métrica: docs/metricas/carga-do-treino.md.
 */

export const PESOS_DAS_ZONAS = [1, 2, 3, 4, 5] as const;

/** Acima desta fração do tempo nas zonas 4 e 5, a FC de pulso passa a merecer aviso (0003). */
export const FRACAO_DE_ESFORCO_ALTO = 0.2;

export type OrigemDaFc = "pulso" | "cinta" | "desconhecido";

/** Segundos em cada zona de FC, da 1 à 5; `null` quando a Garmin não informou. */
export type TemposPorZona = readonly [
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
];

/** FC mínima de cada zona (da 1 à 5), como a Garmin informa. */
export type PisosDeZona = readonly [number, number, number, number, number];

export interface AtividadeDeCarga {
  readonly id: number;
  readonly dataLocal: Dia;
  readonly tipo: string;
  readonly duracaoS: number;
  readonly fcMedia: number | null;
  readonly fcOrigem: OrigemDaFc;
  readonly temposPorZonaS: TemposPorZona;
}

export type MetodoDaCarga = "zonas" | "fc_media";
export type AvisoDaCarga = "estimativa_simplificada" | "fc_de_pulso_em_esforco_alto";

export type CargaDoTreino =
  | {
      readonly tipo: "calculada";
      readonly valor: number;
      readonly metodo: MetodoDaCarga;
      readonly aviso: AvisoDaCarga | null;
    }
  /** Sem tempo em zona nem FC média utilizável: o treino fica fora da carga (decisão D2). */
  | { readonly tipo: "sem_fc" };

function medidaValida(valor: number | null): number | null {
  return valor !== null && Number.isFinite(valor) && valor >= 0 ? valor : null;
}

/** Zona (0 a 5) em que uma FC cai, pelos pisos da Garmin; 0 = abaixo da zona 1. */
function zonaDaFc(fc: number, pisos: PisosDeZona): number {
  return pisos.filter((piso) => fc >= piso).length;
}

export function cargaDoTreino(
  atividade: AtividadeDeCarga,
  pisos: PisosDeZona | null,
): CargaDoTreino {
  const tempos = atividade.temposPorZonaS.map(medidaValida);
  const totalEmZonas = tempos.reduce<number>((soma, t) => soma + (t ?? 0), 0);

  if (totalEmZonas > 0) {
    const segundosPonderados = tempos.reduce<number>(
      (soma, t, i) => soma + (t ?? 0) * (PESOS_DAS_ZONAS[i] ?? 0),
      0,
    );
    const emEsforcoAlto = (tempos[3] ?? 0) + (tempos[4] ?? 0);
    const aviso =
      emEsforcoAlto / totalEmZonas > FRACAO_DE_ESFORCO_ALTO && atividade.fcOrigem !== "cinta"
        ? "fc_de_pulso_em_esforco_alto"
        : null;
    return { tipo: "calculada", valor: segundosPonderados / 60, metodo: "zonas", aviso };
  }

  // Decisão D1: sem tempo em zona, todo o tempo vai para a zona da FC média.
  const fcMedia = medidaValida(atividade.fcMedia);
  const duracaoS = medidaValida(atividade.duracaoS);
  if (fcMedia !== null && fcMedia > 0 && duracaoS !== null && pisos !== null) {
    return {
      tipo: "calculada",
      valor: (duracaoS / 60) * zonaDaFc(fcMedia, pisos),
      metodo: "fc_media",
      aviso: "estimativa_simplificada",
    };
  }
  return { tipo: "sem_fc" };
}

export interface TreinoComCarga {
  readonly atividade: AtividadeDeCarga;
  readonly carga: CargaDoTreino;
}

/** Soma da carga por dia. Treinos sem FC não entram (e são contados por quem chamar). */
export function cargaPorDia(treinos: readonly TreinoComCarga[]): Map<Dia, number> {
  const porDia = new Map<Dia, number>();
  for (const { atividade, carga } of treinos) {
    if (carga.tipo !== "calculada") continue;
    porDia.set(atividade.dataLocal, (porDia.get(atividade.dataLocal) ?? 0) + carga.valor);
  }
  return porDia;
}

/** Os treinos de maior carga nos últimos `dias` dias (contando hoje), para "Por que mudou?". */
export function treinosQueMaisPesaram(
  treinos: readonly TreinoComCarga[],
  hoje: Dia,
  quantos = 3,
  dias = 7,
): readonly TreinoComCarga[] {
  return treinos
    .filter(({ atividade, carga }) => {
      const atras = diasEntre(atividade.dataLocal, hoje);
      return carga.tipo === "calculada" && atras >= 0 && atras < dias;
    })
    .sort((a, b) => cargaOuZero(b) - cargaOuZero(a) || b.atividade.id - a.atividade.id)
    .slice(0, quantos);
}

function cargaOuZero({ carga }: TreinoComCarga): number {
  return carga.tipo === "calculada" ? carga.valor : 0;
}

/** Quantos treinos dos últimos `dias` dias ficaram fora da carga por falta de FC. */
export function treinosSemFc(treinos: readonly TreinoComCarga[], hoje: Dia, dias = 7): number {
  const inicio = somarDias(hoje, -(dias - 1));
  return treinos.filter(
    ({ atividade, carga }) =>
      carga.tipo === "sem_fc" && atividade.dataLocal >= inicio && atividade.dataLocal <= hoje,
  ).length;
}
