const SECONDS_PER_MINUTE = 60;
const METERS_PER_KILOMETER = 1000;

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(
      `${name} precisa ser um número finito maior que zero; recebido: ${String(value)}`,
    );
  }
}

/** A Garmin entrega velocidade em metros por segundo; corredores leem ritmo em segundos por km. */
export function speedToPace(metersPerSecond: number): number {
  assertPositiveFinite(metersPerSecond, "metersPerSecond");
  return METERS_PER_KILOMETER / metersPerSecond;
}

export function paceToSpeed(secondsPerKm: number): number {
  assertPositiveFinite(secondsPerKm, "secondsPerKm");
  return METERS_PER_KILOMETER / secondsPerKm;
}

export function averagePace(distanceMeters: number, durationSeconds: number): number {
  assertPositiveFinite(distanceMeters, "distanceMeters");
  assertPositiveFinite(durationSeconds, "durationSeconds");
  return durationSeconds / (distanceMeters / METERS_PER_KILOMETER);
}

/** Formata segundos por km como "m:ss/km", arredondando para o segundo mais próximo. */
export function formatPace(secondsPerKm: number): string {
  assertPositiveFinite(secondsPerKm, "secondsPerKm");
  const totalSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${String(minutes)}:${String(seconds).padStart(2, "0")}/km`;
}
