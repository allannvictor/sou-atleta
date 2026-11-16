import { somarDias } from "@sou-atleta/core";
import type { AtividadeLida, DadosDoMomentoAtual } from "@sou-atleta/db";
import { frasesLongas, verificarLinguagem } from "@sou-atleta/narrative";
import { describe, expect, it } from "vitest";

import { montarMomentoAtual, type MomentoAtual } from "./momento-atual";

const AGORA = new Date("2026-11-15T15:00:00.000Z"); // 12h em São Paulo, dia 2026-11-15

/** Atividades sintéticas, só para testar: um treino a cada 2 dias, com variações. */
function atividadesSinteticas(dias: number): AtividadeLida[] {
  const lista: AtividadeLida[] = [];
  for (let i = 0; i < dias; i += 2) {
    const dataLocal = somarDias("2026-11-15", -i);
    lista.push({
      id: i + 1,
      dataLocal,
      tipo: i % 6 === 0 ? "cycling" : "running",
      duracaoS: 2400 + (i % 5) * 600,
      distanciaM: i % 6 === 0 ? 30_000 : 8000 + (i % 4) * 1000,
      fcMedia: 150,
      fcOrigem: i % 4 === 0 ? "cinta" : "pulso",
      temposPorZonaS: [300, 1200, 600 + (i % 3) * 300, 300, i % 5 === 0 ? 300 : 0],
    });
  }
  return lista.reverse();
}

const dados = (dias: number, extra: Partial<DadosDoMomentoAtual> = {}): DadosDoMomentoAtual => ({
  fusoHorario: "America/Sao_Paulo",
  inicioDasAtividades: somarDias("2026-11-15", -(dias - 1)),
  importacaoEmAndamento: false,
  atividades: atividadesSinteticas(dias),
  zonas: [{ esporte: "DEFAULT", pisos: [100, 120, 140, 160, 175] }],
  hrv: [],
  resumos: [],
  sonos: [],
  ...extra,
});

function pronto(momento: MomentoAtual) {
  if (momento.situacao !== "pronto") throw new Error(`esperava "pronto", veio ${momento.situacao}`);
  return momento;
}

function todosOsTextos(m: ReturnType<typeof pronto>): string[] {
  return [
    ...(m.avisoDaImportacao === null ? [] : [m.avisoDaImportacao]),
    ...(m.conhecendoABase === null ? [] : [m.conhecendoABase]),
    m.explicacaoDaCarga,
    ...m.cartoes.flatMap((c) => [c.frase, c.explicacao]),
    ...m.porQueMudou.flatMap((t) => [t.texto, ...(t.aviso === null ? [] : [t.aviso])]),
    ...(m.treinosFora === null ? [] : [m.treinosFora]),
    m.variacao,
    ...m.semanas.map((s) => s.frase),
    ...m.tendenciaDoVolume,
    ...(m.conhecendoOVolume === null ? [] : [m.conhecendoOVolume]),
    ...(m.intensidade === null ? [] : [m.intensidade.frase]),
    m.explicacaoDoNormal,
    ...m.recuperacao.flatMap((c) => [
      ...c.frases,
      c.explicacao,
      ...c.ultimosDias,
      ...(c.origem === null ? [] : [c.origem]),
    ]),
  ];
}

describe("Momento atual", () => {
  it("90 dias de dados: Base formada, três cartões, treinos que mais pesaram e tendência", () => {
    const m = pronto(montarMomentoAtual(dados(90), AGORA));
    expect(m.conhecendoABase).toBeNull();
    expect(m.cartoes.map((c) => c.nome)).toEqual(["Base", "Carga recente", "Saldo"]);
    expect(Number(m.cartoes[0]?.valor)).toBeGreaterThan(0);
    expect(m.porQueMudou).toHaveLength(3);
    expect(m.variacao).toContain("sua média das 6 semanas anteriores");
    expect(m.semanas).toHaveLength(9);
    expect(m.semanas[0]?.rotulo).toContain("(em andamento)");
    expect(m.tendenciaDoVolume.length).toBeGreaterThan(0);
    expect(m.conhecendoOVolume).toBeNull();
    expect(m.intensidade?.zonas).toHaveLength(5);
  });

  it("poucos dias de dados: Conhecendo você na Base, na variação e no volume", () => {
    const m = pronto(montarMomentoAtual(dados(20), AGORA));
    expect(m.conhecendoABase).toBe(
      "Conhecendo você: faltam 22 dias de dados para sua Base ficar completa.",
    );
    expect(m.variacao).toContain("Conhecendo você");
    expect(m.conhecendoOVolume).toContain("Conhecendo você");
    expect(m.tendenciaDoVolume).toEqual([]);
  });

  it("importação em andamento avisa que os números ainda mudam", () => {
    const m = pronto(montarMomentoAtual(dados(30, { importacaoEmAndamento: true }), AGORA));
    expect(m.avisoDaImportacao).toContain("ainda vão mudar");
  });

  it("sem atividades ou sem janela de importação, diz que ainda não há dados", () => {
    expect(montarMomentoAtual(dados(30, { atividades: [] }), AGORA)).toEqual({
      situacao: "sem_atividades",
      importacaoEmAndamento: false,
    });
    expect(montarMomentoAtual(dados(30, { inicioDasAtividades: null }), AGORA).situacao).toBe(
      "sem_atividades",
    );
  });

  it("treino sem FC fica fora da carga e a tela diz isso", () => {
    const base = dados(30);
    const semFc: AtividadeLida = {
      id: 999,
      dataLocal: "2026-11-14",
      tipo: "strength_training",
      duracaoS: 3000,
      distanciaM: null,
      fcMedia: null,
      fcOrigem: "desconhecido",
      temposPorZonaS: [null, null, null, null, null],
    };
    const m = pronto(
      montarMomentoAtual({ ...base, atividades: [...base.atividades, semFc] }, AGORA),
    );
    expect(m.treinosFora).toBe(
      "1 treino dos últimos 7 dias ficou fora da carga porque não tem frequência cardíaca.",
    );
  });

  it("sem pisos de zona, atividade sem tempo em zona também fica fora (sem inventar)", () => {
    const m = pronto(
      montarMomentoAtual(
        dados(30, {
          zonas: [],
          atividades: [
            {
              id: 1,
              dataLocal: "2026-11-14",
              tipo: "running",
              duracaoS: 3000,
              distanciaM: 8000,
              fcMedia: 150,
              fcOrigem: "pulso",
              temposPorZonaS: [null, null, null, null, null],
            },
          ],
        }),
        AGORA,
      ),
    );
    expect(m.treinosFora).toContain("1 treino");
    expect(m.porQueMudou).toEqual([]);
  });

  it("nenhum texto da tela recomenda, julga ou fala de risco, e todas as frases são curtas", () => {
    for (const dias of [20, 50, 90]) {
      const m = pronto(
        montarMomentoAtual(dados(dias, { importacaoEmAndamento: dias < 90 }), AGORA),
      );
      for (const texto of todosOsTextos(m)) {
        expect({ texto, problemas: verificarLinguagem(texto) }).toEqual({ texto, problemas: [] });
        expect(frasesLongas(texto)).toEqual([]);
      }
    }
  });

  it("os percentuais da intensidade somam 100", () => {
    const m = pronto(montarMomentoAtual(dados(90), AGORA));
    const soma = (m.intensidade?.zonas ?? []).reduce((a, z) => a + z.percentual, 0);
    expect(soma).toBeCloseTo(100, 6);
  });

  it("recuperação com 40 dias de dados: compara com o Seu normal e mostra os 7 dias", () => {
    const dias = Array.from({ length: 40 }, (_, i) => somarDias("2026-11-15", -i));
    const m = pronto(
      montarMomentoAtual(
        dados(90, {
          // HRV estável em 50 ms, com a última semana em 70 ms (acima do normal).
          hrv: dias.map((data, i) => ({ data, hrvNoiteMs: i < 7 ? 70 : 50 + (i % 2) })),
          // FC de repouso em torno de 49 bpm, hoje 40 (abaixo).
          resumos: dias.map((data, i) => ({
            data,
            fcRepouso: i === 0 ? 40 : 48 + (i % 3),
            fcRepousoOrigem: "pulso" as const,
          })),
          // Sono de 7 h, com 7 h 30 min nas noites normais e 5 h na última.
          sonos: dias.map((data, i) => ({
            data,
            sonoS: i === 0 ? 18_000 : 25_200 + (i % 3) * 900,
          })),
        }),
        AGORA,
      ),
    );
    const [hrv, fc, sono] = m.recuperacao;
    expect(m.recuperacao.map((c) => c.nome)).toEqual(["HRV", "FC de repouso", "Sono"]);
    expect(hrv?.frases[0]).toMatch(
      /^Sua HRV média dos últimos 7 dias: .* ms\. Está acima do seu normal/,
    );
    expect(fc?.frases[0]).toMatch(/^Sua FC de repouso hoje: 40 bpm\. Está abaixo do seu normal/);
    expect(fc?.origem).toBe("Medida pelo sensor de pulso.");
    expect(sono?.frases).toHaveLength(2);
    expect(sono?.frases[0]).toMatch(
      /^Seu sono na última noite: 5 h 00 min\. Está abaixo do seu normal/,
    );
    expect(hrv?.ultimosDias).toHaveLength(7);
    expect(hrv?.ultimosDias.at(-1)).toBe("15/11: 70 ms");
  });

  it("recuperação com poucos dias: Conhecendo você, uma frase só, sem inventar normal", () => {
    const dias = Array.from({ length: 10 }, (_, i) => somarDias("2026-11-15", -i));
    const m = pronto(
      montarMomentoAtual(
        dados(90, { sonos: dias.map((data) => ({ data, sonoS: 25_200 })) }),
        AGORA,
      ),
    );
    // 10 dias de sono, mas hoje fica fora do normal: só 9 contam, faltam 12 dos 21.
    const sono = m.recuperacao[2];
    expect(sono?.frases).toEqual([
      "Conhecendo você: faltam 12 dias de dados de sono para formar seu normal.",
    ]);
    // Sem nenhuma medida de HRV, também é Conhecendo você; nunca vira zero.
    expect(m.recuperacao[0]?.frases[0]).toContain("faltam 21 dias de dados de HRV");
  });

  it("valores zero da Garmin ('sem dados') não viram medida", () => {
    const dias = Array.from({ length: 30 }, (_, i) => somarDias("2026-11-15", -i));
    const m = pronto(
      montarMomentoAtual(dados(90, { hrv: dias.map((data) => ({ data, hrvNoiteMs: 0 })) }), AGORA),
    );
    expect(m.recuperacao[0]?.frases[0]).toContain("Conhecendo você");
  });
});
