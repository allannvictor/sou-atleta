const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const umaCasa = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function numeroInteiro(valor: number): string {
  return inteiro.format(Math.round(valor));
}

export function numeroComUmaCasa(valor: number): string {
  return umaCasa.format(valor);
}

/** "10/11" a partir de `2026-11-10`. */
export function diaEMes(dia: string): string {
  const [, mes, diaDoMes] = dia.split("-");
  return `${diaDoMes ?? "??"}/${mes ?? "??"}`;
}

/** "50 min" ou "1 h 05 min". */
export function duracao(segundos: number): string {
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${String(minutos)} min`;
  return `${String(Math.floor(minutos / 60))} h ${String(minutos % 60).padStart(2, "0")} min`;
}

const NOMES_DOS_TIPOS: Readonly<Record<string, string>> = {
  running: "Corrida",
  treadmill_running: "Corrida na esteira",
  trail_running: "Corrida de trilha",
  track_running: "Corrida na pista",
  virtual_run: "Corrida virtual",
  cycling: "Pedal",
  indoor_cycling: "Pedal indoor",
  mountain_biking: "Mountain bike",
  lap_swimming: "Natação",
  open_water_swimming: "Natação em águas abertas",
  strength_training: "Musculação",
  walking: "Caminhada",
  hiking: "Trilha a pé",
  yoga: "Yoga",
  elliptical: "Elíptico",
};

export function nomeDoTipo(tipo: string): string {
  return NOMES_DOS_TIPOS[tipo] ?? "Treino";
}
