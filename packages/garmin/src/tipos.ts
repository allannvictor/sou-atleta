/** Os quatro fluxos que o conector busca por janelas de datas. */
export type Fluxo = "atividades" | "resumo_diario" | "sono" | "hrv";

export type OrigemDeFc = "pulso" | "cinta" | "desconhecido";

type Numero = number | null;

/**
 * Tudo que sai deste pacote já passou pelo Zod e só tem o que a decisão 0007 permite guardar.
 * Os nomes dos campos são os mesmos das colunas do banco (`packages/db`). Cada registro carrega
 * a fonte.
 */
export interface AtividadeGarmin {
  readonly fonte: "garmin";
  readonly id: number;
  readonly dataLocal: string;
  readonly inicioLocal: string;
  readonly inicioGmt: string;
  readonly tipo: string;
  readonly duracaoS: number;
  readonly distanciaM: Numero;
  readonly fcMedia: Numero;
  readonly fcMaxima: Numero;
  readonly tempoZona1S: Numero;
  readonly tempoZona2S: Numero;
  readonly tempoZona3S: Numero;
  readonly tempoZona4S: Numero;
  readonly tempoZona5S: Numero;
  readonly vo2max: Numero;
  readonly efeitoAerobico: Numero;
  readonly efeitoAnaerobico: Numero;
}

export interface DiaHrvGarmin {
  readonly fonte: "garmin";
  readonly data: string;
  readonly hrvNoiteMs: Numero;
  readonly hrvSemanaMs: Numero;
  readonly hrvPico5minMs: Numero;
  readonly estado: string | null;
}

export interface DiaSonoGarmin {
  readonly fonte: "garmin";
  readonly data: string;
  readonly sonoS: Numero;
  readonly profundoS: Numero;
  readonly leveS: Numero;
  readonly remS: Numero;
  readonly acordadoS: Numero;
}

export interface DiaResumoGarmin {
  readonly fonte: "garmin";
  readonly data: string;
  readonly fcRepouso: Numero;
  readonly estresseMedio: Numero;
  readonly estresseMaximo: Numero;
  readonly bodyBatteryMin: Numero;
  readonly bodyBatteryMax: Numero;
  readonly bodyBatteryCarregada: Numero;
  readonly bodyBatteryDrenada: Numero;
  readonly bodyBatteryFimDoDia: Numero;
}

export interface ZonaFcGarmin {
  readonly fonte: "garmin";
  readonly esporte: string;
  readonly metodo: string | null;
  readonly fcMaxima: Numero;
  readonly fcRepouso: Numero;
  readonly fcLimiar: Numero;
  readonly zona1Piso: number;
  readonly zona2Piso: number;
  readonly zona3Piso: number;
  readonly zona4Piso: number;
  readonly zona5Piso: number;
}

export interface PerfilGarmin {
  readonly fonte: "garmin";
  readonly sistemaDeMedidas: string | null;
  readonly fusoHorario: string | null;
  /** Lista de dias em JSON (por exemplo `["monday","friday"]`) ou nada. */
  readonly diasDisponiveis: string | null;
  readonly diasLongos: string | null;
}
