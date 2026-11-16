import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { somarDias } from "../corrida/datas.js";
import {
  calcularSeuNormal,
  mediaDosUltimosDias,
  medidaDeHoje,
  medidasDoTrecho,
  posicaoNoNormal,
  type SeuNormal,
} from "./seu-normal.js";

const HOJE = "2026-11-15";

/** Medidas dos 30 dias anteriores a hoje, do mais antigo (30 dias atrás) ao de ontem. */
function dosUltimos30(valores: readonly (number | null)[]): Map<string, number> {
  const mapa = new Map<string, number>();
  valores.forEach((valor, i) => {
    if (valor !== null) mapa.set(somarDias(HOJE, -(valores.length - i)), valor);
  });
  return mapa;
}

function calculado(normal: SeuNormal) {
  if (normal.tipo !== "calculado") throw new Error("esperava um normal calculado");
  return normal;
}

describe("Seu normal", () => {
  it("exemplo da especificação: média 49 e desvio 2,5 dão a faixa 46,5 a 51,5", () => {
    // 15 dias de 46,5 e 15 de 51,5 têm média 49; o desvio amostral é 2,5 x raiz(30/29).
    const normal = calculado(
      calcularSeuNormal(
        dosUltimos30([...Array<number>(15).fill(46.5), ...Array<number>(15).fill(51.5)]),
        HOJE,
      ),
    );
    expect(normal.media).toBeCloseTo(49, 9);
    expect(normal.desvioPadrao).toBeCloseTo(2.5 * Math.sqrt(30 / 29), 9);
    expect(normal.minimo).toBeCloseTo(49 - normal.desvioPadrao, 9);
    expect(normal.maximo).toBeCloseTo(49 + normal.desvioPadrao, 9);
  });

  it("a posição: abaixo, dentro e acima da faixa (limites contam como dentro)", () => {
    const normal = calculado(
      calcularSeuNormal(
        dosUltimos30([...Array<number>(15).fill(46), ...Array<number>(15).fill(52)]),
        HOJE,
      ),
    );
    expect(posicaoNoNormal(53, normal)).toBe("acima");
    expect(posicaoNoNormal(49, normal)).toBe("dentro");
    expect(posicaoNoNormal(normal.minimo, normal)).toBe("dentro");
    expect(posicaoNoNormal(normal.maximo, normal)).toBe("dentro");
    expect(posicaoNoNormal(45, normal)).toBe("abaixo");
  });

  it("com 21 dias de medida o normal existe; com 20, é Conhecendo você (faltam 1)", () => {
    const com = (n: number) =>
      dosUltimos30([...Array<null>(30 - n).fill(null), ...Array<number>(n).fill(50)]);
    expect(calcularSeuNormal(com(21), HOJE).tipo).toBe("calculado");
    expect(calcularSeuNormal(com(20), HOJE)).toEqual({
      tipo: "conhecendo",
      diasComMedida: 20,
      faltamDias: 1,
    });
    expect(calcularSeuNormal(new Map(), HOJE)).toMatchObject({ faltamDias: 21 });
  });

  it("hoje fica fora do normal; medidas mais velhas que 30 dias também", () => {
    const mapa = dosUltimos30(Array<number>(30).fill(50));
    mapa.set(HOJE, 500);
    mapa.set(somarDias(HOJE, -31), 500);
    expect(calculado(calcularSeuNormal(mapa, HOJE)).media).toBeCloseTo(50, 9);
  });

  it("ignora medidas que não são números finitos", () => {
    const mapa = dosUltimos30(Array<number>(30).fill(50));
    mapa.set(somarDias(HOJE, -1), Number.NaN);
    expect(calculado(calcularSeuNormal(mapa, HOJE)).diasComMedida).toBe(29);
  });

  it("média dos últimos 7 dias: precisa de pelo menos 3 medidas, contando hoje", () => {
    const mapa = new Map([
      [HOJE, 60],
      [somarDias(HOJE, -3), 50],
      [somarDias(HOJE, -6), 40],
      [somarDias(HOJE, -7), 999], // fora da janela de 7 dias
    ]);
    expect(mediaDosUltimosDias(mapa, HOJE)).toBeCloseTo(50, 9);
    mapa.delete(somarDias(HOJE, -6));
    expect(mediaDosUltimosDias(mapa, HOJE)).toBeNull();
  });

  it("medida de hoje e trecho dos últimos dias, na ordem do mais antigo ao mais novo", () => {
    const mapa = new Map([
      [HOJE, 52],
      [somarDias(HOJE, -2), 49],
    ]);
    expect(medidaDeHoje(mapa, HOJE)).toBe(52);
    expect(medidaDeHoje(new Map(), HOJE)).toBeNull();
    const trecho = medidasDoTrecho(mapa, HOJE, 3);
    expect(trecho.map((t) => t.valor)).toEqual([49, null, 52]);
    expect(trecho[2]?.dia).toBe(HOJE);
  });

  const valor = fc.double({ min: 20, max: 120, noNaN: true });
  const trinta = fc.array(valor, { minLength: 30, maxLength: 30 });

  it("propriedade: a faixa sempre contém a média e o desvio nunca é negativo", () => {
    fc.assert(
      fc.property(trinta, (valores) => {
        const n = calculado(calcularSeuNormal(dosUltimos30(valores), HOJE));
        return n.desvioPadrao >= 0 && n.minimo <= n.media && n.media <= n.maximo;
      }),
    );
  });

  it("propriedade: somar uma constante desloca a média e não muda o desvio", () => {
    fc.assert(
      fc.property(trinta, fc.double({ min: -50, max: 50, noNaN: true }), (valores, c) => {
        const a = calculado(calcularSeuNormal(dosUltimos30(valores), HOJE));
        const b = calculado(calcularSeuNormal(dosUltimos30(valores.map((v) => v + c)), HOJE));
        return (
          Math.abs(b.media - (a.media + c)) < 1e-6 &&
          Math.abs(b.desvioPadrao - a.desvioPadrao) < 1e-6
        );
      }),
    );
  });

  it("propriedade: dias sem medida não mudam o resultado (não viram zero)", () => {
    fc.assert(
      fc.property(trinta, (valores) => {
        const completo = dosUltimos30(valores);
        const comLacunas = new Map(completo);
        // Tira só o que sobra além de 21 dias: o resultado continua calculado, e as lacunas
        // nunca aparecem como zeros na média.
        for (let i = 1; i <= 9; i += 1) comLacunas.delete(somarDias(HOJE, -i));
        const n = calculado(calcularSeuNormal(comLacunas, HOJE));
        return n.diasComMedida === 21 && n.media >= 20 && n.media <= 120;
      }),
    );
  });

  it("propriedade: com menos de 21 medidas, o resultado é sempre Conhecendo você", () => {
    fc.assert(
      fc.property(fc.array(valor, { minLength: 0, maxLength: 20 }), (valores) => {
        const normal = calcularSeuNormal(
          dosUltimos30([...Array<null>(30 - valores.length).fill(null), ...valores]),
          HOJE,
        );
        return normal.tipo === "conhecendo" && normal.faltamDias === 21 - valores.length;
      }),
    );
  });
});
