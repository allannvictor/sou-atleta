import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  cargaDoTreino,
  cargaPorDia,
  treinosQueMaisPesaram,
  treinosSemFc,
  type AtividadeDeCarga,
  type PisosDeZona,
  type TemposPorZona,
  type TreinoComCarga,
} from "./carga.js";

const PISOS: PisosDeZona = [100, 120, 140, 160, 175];

function atividade(parcial: Partial<AtividadeDeCarga> = {}): AtividadeDeCarga {
  return {
    id: 1,
    dataLocal: "2026-11-10",
    tipo: "running",
    duracaoS: 3000,
    fcMedia: 150,
    fcOrigem: "cinta",
    temposPorZonaS: [300, 1200, 900, 480, 120],
    ...parcial,
  };
}

describe("carga do treino (TRIMP de Edwards)", () => {
  it("exemplo da especificação: 5, 20, 15, 8 e 2 minutos nas zonas 1 a 5 valem 132", () => {
    const carga = cargaDoTreino(atividade(), PISOS);
    expect(carga).toEqual({ tipo: "calculada", valor: 132, metodo: "zonas", aviso: null });
  });

  it("sem tempo em zona, todo o tempo vai para a zona da FC média (D1)", () => {
    const carga = cargaDoTreino(
      atividade({ temposPorZonaS: [null, null, null, null, null], fcMedia: 150, duracaoS: 3600 }),
      PISOS,
    );
    // FC 150 cai na zona 3 (piso 140): 60 min x 3.
    expect(carga).toEqual({
      tipo: "calculada",
      valor: 180,
      metodo: "fc_media",
      aviso: "estimativa_simplificada",
    });
  });

  it("zonas todas zero contam como ausentes, como as nulas", () => {
    const carga = cargaDoTreino(atividade({ temposPorZonaS: [0, 0, 0, 0, 0] }), PISOS);
    expect(carga).toMatchObject({ metodo: "fc_media" });
  });

  it("FC média abaixo da zona 1 dá carga zero, não erro", () => {
    const carga = cargaDoTreino(
      atividade({ temposPorZonaS: [null, null, null, null, null], fcMedia: 90 }),
      PISOS,
    );
    expect(carga).toMatchObject({ tipo: "calculada", valor: 0 });
  });

  it("sem FC nenhuma, ou sem pisos para estimar, o treino fica fora (D2)", () => {
    const semZonas: TemposPorZona = [null, null, null, null, null];
    expect(cargaDoTreino(atividade({ temposPorZonaS: semZonas, fcMedia: null }), PISOS)).toEqual({
      tipo: "sem_fc",
    });
    expect(cargaDoTreino(atividade({ temposPorZonaS: semZonas }), null)).toEqual({
      tipo: "sem_fc",
    });
  });

  it("FC de pulso com mais de 20% do tempo nas zonas 4 e 5 ganha aviso; cinta não (D7)", () => {
    const intenso: TemposPorZona = [300, 600, 300, 900, 900];
    expect(
      cargaDoTreino(atividade({ temposPorZonaS: intenso, fcOrigem: "pulso" }), PISOS),
    ).toMatchObject({
      aviso: "fc_de_pulso_em_esforco_alto",
    });
    expect(
      cargaDoTreino(atividade({ temposPorZonaS: intenso, fcOrigem: "desconhecido" }), PISOS),
    ).toMatchObject({ aviso: "fc_de_pulso_em_esforco_alto" });
    expect(
      cargaDoTreino(atividade({ temposPorZonaS: intenso, fcOrigem: "cinta" }), PISOS),
    ).toMatchObject({
      aviso: null,
    });
  });

  it("valores inválidos da Garmin (negativos, NaN) são ignorados", () => {
    const carga = cargaDoTreino(
      atividade({ temposPorZonaS: [-5, Number.NaN, 600, null, null] }),
      PISOS,
    );
    expect(carga).toMatchObject({ valor: 30, metodo: "zonas" });
  });

  const segundos = fc.double({ min: 0, max: 20_000, noNaN: true });
  const tempos = fc.tuple(segundos, segundos, segundos, segundos, segundos);

  it("propriedade: a carga nunca é negativa", () => {
    fc.assert(
      fc.property(tempos, (t) => {
        const carga = cargaDoTreino(atividade({ temposPorZonaS: t }), PISOS);
        return carga.tipo !== "calculada" || carga.valor >= 0;
      }),
    );
  });

  it("propriedade: mais tempo em qualquer zona nunca reduz a carga", () => {
    fc.assert(
      fc.property(tempos, fc.integer({ min: 0, max: 4 }), segundos, (t, zona, extra) => {
        const mais = t.map((v, i) => (i === zona ? v + extra : v)) as unknown as TemposPorZona;
        const antes = cargaDoTreino(atividade({ temposPorZonaS: t }), PISOS);
        const depois = cargaDoTreino(atividade({ temposPorZonaS: mais }), PISOS);
        return (
          antes.tipo === "calculada" &&
          depois.tipo === "calculada" &&
          depois.valor >= antes.valor - 1e-9
        );
      }),
    );
  });

  it("propriedade: a carga é a soma ponderada por zona, em minutos", () => {
    fc.assert(
      fc.property(tempos, (t) => {
        const carga = cargaDoTreino(atividade({ temposPorZonaS: t }), PISOS);
        const esperado = t.reduce((soma, v, i) => soma + (v / 60) * (i + 1), 0);
        if (t.every((v) => v === 0)) return true;
        return carga.tipo === "calculada" && Math.abs(carga.valor - esperado) < 1e-6;
      }),
    );
  });
});

describe("carga por dia e treinos que mais pesaram", () => {
  const treino = (id: number, dataLocal: string, valor: number | null): TreinoComCarga => ({
    atividade: atividade({ id, dataLocal }),
    carga:
      valor === null
        ? { tipo: "sem_fc" }
        : { tipo: "calculada", valor, metodo: "zonas", aviso: null },
  });
  const treinos = [
    treino(1, "2026-11-10", 50),
    treino(2, "2026-11-10", 70),
    treino(3, "2026-11-12", 90),
    treino(4, "2026-11-13", null),
    treino(5, "2026-11-01", 500),
    treino(6, "2026-11-14", 10),
    treino(7, "2026-11-15", 20),
  ];

  it("soma por dia e ignora treino sem FC", () => {
    const porDia = cargaPorDia(treinos);
    expect(porDia.get("2026-11-10")).toBe(120);
    expect(porDia.has("2026-11-13")).toBe(false);
  });

  it("escolhe os 3 maiores dos últimos 7 dias, do maior para o menor", () => {
    const top = treinosQueMaisPesaram(treinos, "2026-11-15");
    expect(top.map((t) => t.atividade.id)).toEqual([3, 2, 1]);
  });

  it("conta os treinos sem FC dos últimos 7 dias", () => {
    expect(treinosSemFc(treinos, "2026-11-15")).toBe(1);
    expect(treinosSemFc(treinos, "2026-11-30")).toBe(0);
  });
});
