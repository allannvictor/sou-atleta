import { describe, expect, it } from "vitest";

import { somarDias } from "./datas.js";
import { ehCorrida, volumeSemanal, type AtividadeDeVolume } from "./volume.js";

// 2026-11-15 é domingo; a semana dele começa em 2026-11-09.
const HOJE = "2026-11-15";

const corrida = (dataLocal: string, km: number, duracaoS = 3600): AtividadeDeVolume => ({
  dataLocal,
  tipo: "running",
  duracaoS,
  distanciaM: km * 1000,
});

describe("tipos de corrida", () => {
  it("reconhece corrida de rua, esteira, trilha e pista, e não o pedal", () => {
    for (const tipo of [
      "running",
      "treadmill_running",
      "trail_running",
      "track_running",
      "virtual_run",
    ]) {
      expect(ehCorrida(tipo)).toBe(true);
    }
    for (const tipo of ["cycling", "lap_swimming", "strength_training", "walking"]) {
      expect(ehCorrida(tipo)).toBe(false);
    }
  });
});

describe("volume semanal", () => {
  it("devolve 8 semanas completas e a semana em andamento, de segunda a domingo", () => {
    const { semanas } = volumeSemanal([], "2026-01-01", HOJE);
    expect(semanas).toHaveLength(9);
    expect(semanas[8]).toMatchObject({ inicio: "2026-11-09", emAndamento: true });
    expect(semanas[0]?.inicio).toBe("2026-09-14");
    expect(semanas.filter((s) => s.emAndamento)).toHaveLength(1);
  });

  it("km só de corrida; tempo e treinos de todas as modalidades (D6)", () => {
    const { semanas } = volumeSemanal(
      [
        corrida("2026-11-09", 10),
        { dataLocal: "2026-11-10", tipo: "cycling", duracaoS: 7200, distanciaM: 50_000 },
        { dataLocal: "2026-11-15", tipo: "strength_training", duracaoS: 1800, distanciaM: null },
      ],
      "2026-01-01",
      HOJE,
    );
    expect(semanas[8]).toMatchObject({ kmDeCorrida: 10, tempoS: 12_600, treinos: 3 });
  });

  it("domingo fica na semana que terminou nele; segunda abre a seguinte", () => {
    const { semanas } = volumeSemanal(
      [corrida("2026-11-08", 5), corrida("2026-11-09", 7)],
      "2026-01-01",
      HOJE,
    );
    expect(semanas[7]?.kmDeCorrida).toBe(5);
    expect(semanas[8]?.kmDeCorrida).toBe(7);
  });

  it("tendência: média das 4 semanas completas mais recentes contra as 4 anteriores", () => {
    const atividades: AtividadeDeVolume[] = [];
    // Semanas completas 0 a 3: 10 km cada; 4 a 7: 15 km cada.
    for (let i = 0; i < 8; i += 1) {
      atividades.push(corrida(somarDias("2026-09-14", 7 * i), i < 4 ? 10 : 15));
    }
    const { tendencia } = volumeSemanal(atividades, "2026-01-01", HOJE);
    expect(tendencia?.kmDeCorrida).toBeCloseTo(50, 9);
    expect(tendencia?.treinos).toBeCloseTo(0, 9);
  });

  it("sem as 8 semanas completas de dados, não há tendência (Conhecendo você)", () => {
    expect(volumeSemanal([], "2026-09-15", HOJE).tendencia).toBeNull();
    expect(volumeSemanal([], "2026-09-14", HOJE).tendencia).not.toBeNull();
  });

  it("sem nada nas 4 semanas anteriores, a variação de km é nula, não infinita", () => {
    const { tendencia } = volumeSemanal([corrida("2026-11-02", 10)], "2026-01-01", HOJE);
    expect(tendencia?.kmDeCorrida).toBeNull();
  });
});
