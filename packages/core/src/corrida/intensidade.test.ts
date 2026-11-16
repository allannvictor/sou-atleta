import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { distribuicaoDeIntensidade } from "./intensidade.js";

const HOJE = "2026-11-15";

describe("distribuição de intensidade", () => {
  it("soma o tempo por zona dos últimos 28 dias e converte em percentual", () => {
    const resultado = distribuicaoDeIntensidade(
      [
        { dataLocal: "2026-11-15", temposPorZonaS: [600, 600, 0, 0, 0] },
        { dataLocal: "2026-10-19", temposPorZonaS: [0, 0, 1200, 0, 0] },
        { dataLocal: "2026-10-18", temposPorZonaS: [9999, 0, 0, 0, 0] }, // 28 dias contam 19/10 a 15/11
      ],
      HOJE,
    );
    expect(resultado?.segundosPorZona).toEqual([600, 600, 1200, 0, 0]);
    expect(resultado?.percentualPorZona[2]).toBeCloseTo(50, 9);
    expect(resultado?.atividadesConsideradas).toBe(2);
  });

  it("sem nenhum tempo em zona, não há distribuição", () => {
    expect(distribuicaoDeIntensidade([], HOJE)).toBeNull();
    expect(
      distribuicaoDeIntensidade(
        [{ dataLocal: HOJE, temposPorZonaS: [null, null, null, null, null] }],
        HOJE,
      ),
    ).toBeNull();
  });

  it("propriedade: os percentuais somam 100 e nenhum passa de 100", () => {
    const segundos = fc.double({ min: 0, max: 10_000, noNaN: true });
    const tempos = fc.tuple(segundos, segundos, segundos, segundos, segundos);
    fc.assert(
      fc.property(fc.array(tempos, { minLength: 1, maxLength: 20 }), (lista) => {
        const resultado = distribuicaoDeIntensidade(
          lista.map((t) => ({ dataLocal: HOJE, temposPorZonaS: t })),
          HOJE,
        );
        if (resultado === null) return lista.every((t) => t.every((v) => v === 0));
        const soma = resultado.percentualPorZona.reduce((a, b) => a + b, 0);
        return (
          Math.abs(soma - 100) < 1e-6 &&
          resultado.percentualPorZona.every((p) => p >= 0 && p <= 100 + 1e-9)
        );
      }),
    );
  });
});
