import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { somarDias } from "./datas.js";
import { variacaoDaCarga } from "./variacao.js";

const HOJE = "2026-11-15";
const DESDE_SUFICIENTE = somarDias(HOJE, -48); // 49 dias de dados
const NA_SEMANA = (carga: number) =>
  new Map(Array.from({ length: 7 }, (_, i) => [somarDias(HOJE, -i), carga / 7] as const));

describe("variação da carga", () => {
  it("exemplo da especificação: 600 contra média semanal de 500 dá +20%", () => {
    const mapa = NA_SEMANA(600);
    for (let semana = 1; semana <= 6; semana += 1) {
      mapa.set(somarDias(HOJE, -7 * semana), 500);
    }
    const resultado = variacaoDaCarga(mapa, DESDE_SUFICIENTE, HOJE);
    expect(resultado.tipo).toBe("calculada");
    expect(resultado.tipo === "calculada" ? resultado.percentual : Number.NaN).toBeCloseTo(20, 9);
  });

  it("com menos de 49 dias de dados, mostra Conhecendo você com os dias que faltam", () => {
    expect(variacaoDaCarga(new Map(), somarDias(HOJE, -47), HOJE)).toEqual({
      tipo: "conhecendo",
      faltamDias: 1,
    });
    expect(variacaoDaCarga(new Map(), HOJE, HOJE)).toEqual({ tipo: "conhecendo", faltamDias: 48 });
  });

  it("com as 6 semanas anteriores sem carga, não há comparação (nada de divisão por zero)", () => {
    const resultado = variacaoDaCarga(NA_SEMANA(300), DESDE_SUFICIENTE, HOJE);
    expect(resultado.tipo).toBe("sem_comparacao");
    expect(resultado.tipo === "sem_comparacao" ? resultado.cargaDaSemana : Number.NaN).toBeCloseTo(
      300,
      9,
    );
  });

  it("propriedade: carga igual em todas as semanas dá variação zero", () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 1000, noNaN: true }), (porDia) => {
        const mapa = new Map(
          Array.from({ length: 49 }, (_, i) => [somarDias(HOJE, -i), porDia] as const),
        );
        const resultado = variacaoDaCarga(mapa, DESDE_SUFICIENTE, HOJE);
        return resultado.tipo === "calculada" && Math.abs(resultado.percentual) < 1e-6;
      }),
    );
  });

  it("propriedade: o percentual nunca fica abaixo de -100", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 500, noNaN: true }), { minLength: 49, maxLength: 49 }),
        (v) => {
          const mapa = new Map(v.map((c, i) => [somarDias(HOJE, -i), c] as const));
          const resultado = variacaoDaCarga(mapa, DESDE_SUFICIENTE, HOJE);
          return resultado.tipo !== "calculada" || resultado.percentual >= -100 - 1e-9;
        },
      ),
    );
  });
});
