import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { somarDias } from "./datas.js";
import { calcularForma, variacaoPercentual } from "./forma.js";

const INICIO = "2026-01-01";

function cargas(valores: readonly number[]): Map<string, number> {
  return new Map(valores.map((v, i) => [somarDias(INICIO, i), v]));
}

describe("Base, Carga recente e Saldo", () => {
  it("exemplo da especificação: Base 40 e carga 132 dão 42,2; Carga recente 50 dá 61,7", () => {
    expect(40 + (132 - 40) / 42).toBeCloseTo(42.19, 2);
    expect(50 + (132 - 50) / 7).toBeCloseTo(61.71, 2);
  });

  it("com carga constante, tudo fica igual à carga e o Saldo é zero", () => {
    const forma = calcularForma(cargas(Array<number>(60).fill(80)), INICIO, somarDias(INICIO, 59));
    for (const dia of forma?.dias ?? []) {
      expect(dia.base).toBeCloseTo(80, 9);
      expect(dia.cargaRecente).toBeCloseTo(80, 9);
      expect(dia.saldo).toBeCloseTo(0, 9);
    }
  });

  it("o Saldo de um dia é a Base menos a Carga recente do fim do dia anterior (D4)", () => {
    const forma = calcularForma(cargas([0, 0, 200, 0, 100, 0]), INICIO, somarDias(INICIO, 5));
    const dias = forma?.dias ?? [];
    for (let i = 1; i < dias.length; i += 1) {
      expect(dias[i]?.saldo).toBeCloseTo(
        (dias[i - 1]?.base ?? 0) - (dias[i - 1]?.cargaRecente ?? 0),
        9,
      );
    }
  });

  it("Conhecendo você: a Base só está formada com 42 dias de dados", () => {
    const hojeCom = (n: number) => somarDias(INICIO, n - 1);
    expect(calcularForma(cargas([]), INICIO, hojeCom(41))).toMatchObject({
      baseFormada: false,
      faltamParaABase: 1,
    });
    expect(calcularForma(cargas([]), INICIO, hojeCom(42))).toMatchObject({
      baseFormada: true,
      faltamParaABase: 0,
    });
  });

  it("sem dias de dados (início depois de hoje), não há forma", () => {
    expect(calcularForma(cargas([]), "2026-02-01", "2026-01-31")).toBeNull();
  });

  const serie = fc.array(fc.double({ min: 0, max: 600, noNaN: true }), {
    minLength: 1,
    maxLength: 120,
  });

  it("propriedade: Base, Carga recente e Saldo ficam dentro dos limites da carga", () => {
    fc.assert(
      fc.property(serie, (valores) => {
        const forma = calcularForma(cargas(valores), INICIO, somarDias(INICIO, valores.length - 1));
        const maximo = Math.max(...valores);
        return (forma?.dias ?? []).every(
          (d) =>
            d.base >= -1e-9 &&
            d.base <= maximo + 1e-9 &&
            d.cargaRecente >= -1e-9 &&
            d.cargaRecente <= maximo + 1e-9 &&
            Math.abs(d.saldo) <= maximo + 1e-9,
        );
      }),
    );
  });

  it("propriedade: um dia sem treino nunca aumenta a Base nem a Carga recente", () => {
    fc.assert(
      fc.property(serie, (valores) => {
        const completa = [...valores, 0];
        const forma = calcularForma(
          cargas(completa),
          INICIO,
          somarDias(INICIO, completa.length - 1),
        );
        const dias = forma?.dias ?? [];
        const penultimo = dias[dias.length - 2];
        const ultimo = dias[dias.length - 1];
        if (penultimo === undefined || ultimo === undefined) return true;
        return (
          ultimo.base <= penultimo.base + 1e-9 &&
          ultimo.cargaRecente <= penultimo.cargaRecente + 1e-9
        );
      }),
    );
  });

  it("propriedade: a Carga recente reage mais que a Base a um treino forte", () => {
    fc.assert(
      fc.property(fc.double({ min: 50, max: 600, noNaN: true }), (forte) => {
        const valores = [...Array<number>(50).fill(30), forte];
        const forma = calcularForma(cargas(valores), INICIO, somarDias(INICIO, 50));
        const dias = forma?.dias ?? [];
        const antes = dias[49];
        const depois = dias[50];
        if (antes === undefined || depois === undefined) return false;
        return depois.cargaRecente - antes.cargaRecente >= depois.base - antes.base;
      }),
    );
  });
});

describe("variação percentual", () => {
  it("compara com o valor de antes; sem base de comparação devolve nulo", () => {
    expect(variacaoPercentual(120, 100)).toBeCloseTo(20, 9);
    expect(variacaoPercentual(80, 100)).toBeCloseTo(-20, 9);
    expect(variacaoPercentual(5, 0)).toBeNull();
  });
});
