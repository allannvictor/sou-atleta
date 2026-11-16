import type { DistribuicaoDeIntensidade, VariacaoDaCarga } from "@sou-atleta/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { frasesLongas, verificarLinguagem } from "./linguagem.js";
import {
  avisoDaCarga,
  conhecendoVoce,
  EXPLICACOES,
  fraseDaBase,
  fraseDaCargaRecente,
  fraseDaDistribuicao,
  fraseDaSemana,
  fraseDaVariacao,
  fraseDoSaldo,
  fraseDosTreinosFora,
  fraseDoTreino,
  frasesDaTendenciaDoVolume,
  fraseDoSinal,
  medidaComUnidade,
  medidaDoDia,
  type FatosDoSinal,
} from "./textos.js";

describe("frases de exemplo", () => {
  it("Base e Carga recente comparam com 7 dias atrás", () => {
    expect(fraseDaBase(42.2, 8)).toBe("Sua Base está em 42. Subiu 8% em relação a 7 dias atrás.");
    expect(fraseDaBase(42.2, -3.4)).toContain("Caiu 3% em relação a 7 dias atrás");
    expect(fraseDaBase(42.2, 0.4)).toContain("praticamente igual");
    expect(fraseDaBase(42.2, null)).toBe("Sua Base está em 42.");
    expect(fraseDaCargaRecente(61.7, 20)).toBe(
      "Sua Carga recente está em 62. Subiu 20% em relação a 7 dias atrás.",
    );
  });

  it("Saldo descreve a posição sem julgar", () => {
    expect(fraseDoSaldo(-10)).toBe(
      "Seu Saldo está em -10: sua Carga recente está acima da sua Base.",
    );
    expect(fraseDoSaldo(7)).toContain("abaixo da sua Base");
    expect(fraseDoSaldo(0.2)).toContain("igual à sua Base");
  });

  it("variação da carga nos três estados", () => {
    expect(
      fraseDaVariacao({
        tipo: "calculada",
        cargaDaSemana: 600,
        mediaSemanalAnterior: 500,
        percentual: 20,
      }),
    ).toBe(
      "Sua carga dos últimos 7 dias foi 600, 20% acima da sua média das 6 semanas anteriores (500 por semana).",
    );
    expect(fraseDaVariacao({ tipo: "conhecendo", faltamDias: 14 })).toBe(
      "Conhecendo você: faltam 14 dias de dados para comparar com suas semanas anteriores.",
    );
    expect(fraseDaVariacao({ tipo: "sem_comparacao", cargaDaSemana: 300 })).toContain(
      "Não há carga nas 6 semanas anteriores",
    );
  });

  it("treino citado em 'Por que mudou?'", () => {
    expect(
      fraseDoTreino({
        dataLocal: "2026-11-10",
        tipo: "running",
        duracaoS: 3000,
        carga: { tipo: "calculada", valor: 132, metodo: "zonas", aviso: null },
      }),
    ).toBe("10/11 · Corrida · 50 min · carga 132");
    expect(
      fraseDoTreino({
        dataLocal: "2026-11-10",
        tipo: "strength_training",
        duracaoS: 4000,
        carga: { tipo: "sem_fc" },
      }),
    ).toBe("10/11 · Musculação · 1 h 07 min · sem frequência cardíaca");
  });

  it("treinos fora da carga: singular, plural e nada", () => {
    expect(fraseDosTreinosFora(0)).toBeNull();
    expect(fraseDosTreinosFora(1)).toContain("1 treino dos últimos 7 dias ficou fora");
    expect(fraseDosTreinosFora(2)).toContain("2 treinos dos últimos 7 dias ficaram fora");
  });
});

describe("explicações fixas", () => {
  it("passam na checagem de linguagem e têm frases curtas", () => {
    for (const texto of Object.values(EXPLICACOES)) {
      expect(verificarLinguagem(texto)).toEqual([]);
      expect(frasesLongas(texto)).toEqual([]);
    }
  });
});

describe("propriedade: nenhuma frase gerada recomenda, julga nem fala de risco", () => {
  const percentual = fc.option(fc.double({ min: -500, max: 500, noNaN: true }), { nil: null });
  const positivo = fc.double({ min: 0, max: 2000, noNaN: true });

  function aprovada(texto: string | null): boolean {
    return (
      texto === null || (verificarLinguagem(texto).length === 0 && frasesLongas(texto).length === 0)
    );
  }

  it("Base, Carga recente, Saldo e Conhecendo você", () => {
    fc.assert(
      fc.property(
        positivo,
        percentual,
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.integer({ min: 0, max: 60 }),
        (v, p, saldo, dias) =>
          [
            fraseDaBase(v, p),
            fraseDaCargaRecente(v, p),
            fraseDoSaldo(saldo),
            conhecendoVoce(dias, "para formar sua Base"),
          ].every(aprovada),
      ),
    );
  });

  it("variação da carga", () => {
    const variacao = fc.oneof(
      fc.record({
        tipo: fc.constant("calculada" as const),
        cargaDaSemana: positivo,
        mediaSemanalAnterior: positivo,
        percentual: fc.double({ min: -100, max: 1000, noNaN: true }),
      }),
      fc.record({
        tipo: fc.constant("conhecendo" as const),
        faltamDias: fc.integer({ min: 0, max: 49 }),
      }),
      fc.record({ tipo: fc.constant("sem_comparacao" as const), cargaDaSemana: positivo }),
    );
    fc.assert(fc.property(variacao, (v: VariacaoDaCarga) => aprovada(fraseDaVariacao(v))));
  });

  it("volume, distribuição, treinos e avisos", () => {
    const zonas = fc.tuple(positivo, positivo, positivo, positivo, positivo);
    fc.assert(
      fc.property(
        positivo,
        positivo,
        fc.integer({ min: 0, max: 20 }),
        percentual,
        zonas,
        (km, tempo, treinos, p, z) => {
          const total = z.reduce((a, b) => a + b, 0) || 1;
          const distribuicao: DistribuicaoDeIntensidade = {
            segundosPorZona: z,
            percentualPorZona: z.map(
              (s) => (s / total) * 100,
            ) as unknown as DistribuicaoDeIntensidade["percentualPorZona"],
            totalS: total,
            atividadesConsideradas: 1,
          };
          return [
            fraseDaSemana({ kmDeCorrida: km, tempoS: tempo * 10, treinos }),
            ...frasesDaTendenciaDoVolume({ kmDeCorrida: p, tempoS: p, treinos: p }),
            fraseDaDistribuicao(distribuicao),
            fraseDosTreinosFora(treinos),
            avisoDaCarga("estimativa_simplificada"),
            avisoDaCarga("fc_de_pulso_em_esforco_alto"),
            fraseDoTreino({
              dataLocal: "2026-11-10",
              tipo: "cycling",
              duracaoS: tempo * 10,
              carga: { tipo: "sem_fc" },
            }),
          ].every(aprovada);
        },
      ),
    );
  });
});

describe("recuperação: frases dos sinais", () => {
  const normal = { tipo: "calculado" as const, media: 49, minimo: 46.5, maximo: 51.5 };
  const base: FatosDoSinal = {
    descricao: "Sua FC de repouso hoje",
    tipo: "bpm",
    valor: 53,
    semMedida: "Sem medida de FC de repouso hoje.",
    objetoDoNormal: "de FC de repouso",
    normal,
    posicao: "acima",
  };

  it("exemplo da especificação: 53 bpm contra média 49 fica acima do normal, com a diferença", () => {
    expect(fraseDoSinal(base)).toBe(
      "Sua FC de repouso hoje: 53 bpm. Está acima do seu normal (de 47 a 52 bpm): 4 bpm acima da sua média de 30 dias.",
    );
  });

  it("dentro do normal não repete a diferença", () => {
    expect(fraseDoSinal({ ...base, valor: 50, posicao: "dentro" })).toBe(
      "Sua FC de repouso hoje: 50 bpm. Está dentro do seu normal (de 47 a 52 bpm).",
    );
  });

  it("sono usa horas e minutos", () => {
    expect(
      fraseDoSinal({
        descricao: "Seu sono na última noite",
        tipo: "sono",
        valor: 6 * 3600 + 30 * 60,
        semMedida: "Sem medida de sono na última noite.",
        objetoDoNormal: "de sono",
        normal: { tipo: "calculado", media: 7 * 3600, minimo: 6.5 * 3600 + 60, maximo: 7.5 * 3600 },
        posicao: "abaixo",
      }),
    ).toBe(
      "Seu sono na última noite: 6 h 30 min. Está abaixo do seu normal (de 6 h 31 min a 7 h 30 min): 30 min abaixo da sua média de 30 dias.",
    );
  });

  it("Conhecendo você e sem medida", () => {
    expect(
      fraseDoSinal({
        ...base,
        normal: { tipo: "conhecendo", faltamDias: 6 },
        objetoDoNormal: "de sono",
      }),
    ).toBe("Conhecendo você: faltam 6 dias de dados de sono para formar seu normal.");
    expect(fraseDoSinal({ ...base, valor: null, posicao: null })).toBe(
      "Sem medida de FC de repouso hoje.",
    );
  });

  it("lista dos últimos dias", () => {
    expect(medidaDoDia("2026-11-09", "ms", 52)).toBe("09/11: 52 ms");
    expect(medidaDoDia("2026-11-10", "ms", null)).toBe("10/11: sem medida");
    expect(medidaComUnidade("sono", 7 * 3600 + 12 * 60)).toBe("7 h 12 min");
  });

  it("propriedade: nenhuma frase de sinal recomenda, julga nem fala de risco", () => {
    const tipo = fc.constantFrom("ms" as const, "bpm" as const, "sono" as const);
    const posicao = fc.constantFrom("abaixo" as const, "dentro" as const, "acima" as const);
    fc.assert(
      fc.property(
        tipo,
        posicao,
        fc.double({ min: 20, max: 30_000, noNaN: true }),
        fc.double({ min: 0, max: 5_000, noNaN: true }),
        fc.integer({ min: 1, max: 21 }),
        (t, p, v, largura, faltam) => {
          const fatos: FatosDoSinal = {
            descricao: t === "sono" ? "Seu sono na última noite" : "Sua medida de hoje",
            tipo: t,
            valor: v,
            semMedida: "Sem medida hoje.",
            objetoDoNormal: "de sono",
            normal: { tipo: "calculado", media: v, minimo: v - largura, maximo: v + largura },
            posicao: p,
          };
          return [
            fraseDoSinal(fatos),
            fraseDoSinal({ ...fatos, normal: { tipo: "conhecendo", faltamDias: faltam } }),
            medidaDoDia("2026-11-10", t, v),
          ].every(
            (frase) => verificarLinguagem(frase).length === 0 && frasesLongas(frase).length === 0,
          );
        },
      ),
    );
  });
});
