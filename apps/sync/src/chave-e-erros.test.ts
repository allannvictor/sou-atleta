import { avisoDaChave, lerFotoDaSincronizacao } from "@sou-atleta/db";
import { atividadeBruta } from "@sou-atleta/garmin/teste";
import { describe, expect, it } from "vitest";

import { sincronizar } from "./sincronizar.js";
import { HOJE, montarAmbiente, QUINZE_MINUTOS } from "./teste/ambiente.js";

const horas = (n: number) => n * 3_600_000;

describe("chave expirada ou revogada", () => {
  it("para, grava 'chave inválida', avisa o dono e segue abrindo com os dados já guardados", async () => {
    const a = montarAmbiente();
    await sincronizar(a.dependencias(), "agendada"); // funciona e guarda dados
    const dadosAntes = a.memoria.despejo();
    expect(dadosAntes).toContain("atividade:");

    a.garmin.revogarChave();
    a.avancar(QUINZE_MINUTOS);
    // O token já emitido ainda "vale" no relógio: o fim do token só aparece na hora de renovar.
    a.avancar(24 * 3_600_000);
    const resumo = await sincronizar(a.dependencias(), "agendada");

    expect(resumo.resultado).toBe("parada_por_erro");
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.estado).toMatchObject({ statusDaChave: "invalida", erroCodigo: "chave_invalida" });
    expect(avisoDaChave(foto.estado, HOJE)).toMatchObject({ tipo: "invalida" });
    // Os dados que já estavam guardados continuam lá.
    expect(a.memoria.despejo()).toContain("atividade:");
    expect(a.memoria.despejo().length).toBeGreaterThanOrEqual(dadosAntes.length);
    expect(a.eventos).toContainEqual({ evento: "chave_invalida" });
  });

  it("depois de recusada, o cron só tenta de novo daqui a 1 hora; o botão tenta na hora", async () => {
    const a = montarAmbiente();
    a.garmin.revogarChave();
    await sincronizar(a.dependencias(), "agendada");
    const pedidos = a.garmin.requisicoes.length;

    a.avancar(QUINZE_MINUTOS);
    expect((await sincronizar(a.dependencias(), "agendada")).resultado).toBe("pausada");
    expect(a.garmin.requisicoes).toHaveLength(pedidos); // nenhuma requisição nova

    a.avancar(70_000);
    const manual = await sincronizar(a.dependencias(), "manual");
    expect(manual.resultado).toBe("parada_por_erro"); // tentou (e a chave segue recusada)
    expect(a.garmin.requisicoes.length).toBe(pedidos + 1);

    a.avancar(horas(2));
    expect((await sincronizar(a.dependencias(), "agendada")).resultado).toBe("parada_por_erro");
  });

  it("com a chave nova funcionando, volta ao normal sozinha", async () => {
    const a = montarAmbiente();
    a.garmin.revogarChave();
    await sincronizar(a.dependencias(), "agendada");

    const outro = montarAmbiente();
    // Mesmo banco, Garmin que aceita a chave: simula o dono cadastrar a chave nova.
    const retomado = {
      ...outro.dependencias(),
      banco: a.banco,
      agora: () => new Date(a.agora() + horas(2)),
    };
    const resumo = await sincronizar(retomado, "agendada");
    expect(resumo.resultado).toBe("concluida");
    expect((await lerFotoDaSincronizacao(a.banco)).estado).toMatchObject({
      statusDaChave: "ok",
      erroCodigo: null,
      pausaAte: null,
    });
  });
});

describe("chave que não está no cofre ou veio mal colada", () => {
  it("ausente: nenhuma requisição à Garmin e aviso claro", async () => {
    const a = montarAmbiente({ chave: "ausente" });
    expect((await sincronizar(a.dependencias(), "agendada")).resultado).toBe("sem_chave");
    expect(a.garmin.requisicoes).toHaveLength(0);
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(avisoDaChave(foto.estado, HOJE)).toEqual({ tipo: "ausente" });
  });

  it("mal colada: aviso próprio, sem falar com a Garmin", async () => {
    const a = montarAmbiente({ chave: "mal_formada" });
    await sincronizar(a.dependencias(), "manual");
    expect(a.garmin.requisicoes).toHaveLength(0);
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(avisoDaChave(foto.estado, HOJE)).toEqual({ tipo: "mal_formada" });
  });
});

describe("aviso de vencimento", () => {
  it("14 dias ou menos: aparece; 15 dias: não aparece", async () => {
    for (const [venceEm, esperado] of [
      ["2026-11-29", { tipo: "vence", dias: 14 }],
      ["2026-11-30", null],
      ["2026-11-16", { tipo: "vence", dias: 1 }],
      ["2026-11-14", { tipo: "venceu" }],
    ] as const) {
      const a = montarAmbiente({ venceEm });
      await sincronizar(a.dependencias(), "agendada");
      const foto = await lerFotoDaSincronizacao(a.banco);
      expect(avisoDaChave(foto.estado, HOJE), venceEm).toEqual(esperado);
    }
  });

  it("sem data de vencimento cadastrada, pede a data", async () => {
    const a = montarAmbiente({ venceEm: null });
    await sincronizar(a.dependencias(), "agendada");
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(avisoDaChave(foto.estado, HOJE)).toEqual({ tipo: "sem_data" });
  });
});

describe("429: esperar em vez de repetir", () => {
  it("para na hora, grava a pausa e não fala com a Garmin até ela passar", async () => {
    const a = montarAmbiente();
    a.garmin.forcarFalha("dailysummaries", { status: 429, cabecalhos: { "Retry-After": "1800" } });
    const resumo = await sincronizar(a.dependencias(), "agendada");
    expect(resumo.resultado).toBe("parada_por_erro");
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.estado).toMatchObject({ erroCodigo: "limite_garmin", falhasDeLimiteSeguidas: 1 });
    const pausaAte = Date.parse(foto.estado?.pausaAte ?? "");
    expect(pausaAte - a.agora()).toBeGreaterThanOrEqual(1700_000);
    const seguidas429 = a.garmin.requisicoes.filter((r) => r.caminho.includes("dailysummaries"));
    expect(seguidas429).toHaveLength(1); // uma só tentativa, sem laço

    const pedidos = a.garmin.requisicoes.length;
    a.avancar(QUINZE_MINUTOS);
    expect((await sincronizar(a.dependencias(), "agendada")).resultado).toBe("pausada");
    a.avancar(70_000);
    expect((await sincronizar(a.dependencias(), "manual")).resultado).toBe("pausada");
    expect(a.garmin.requisicoes).toHaveLength(pedidos);

    a.garmin.limparFalhas();
    a.avancar(horas(1));
    const depois = await sincronizar(a.dependencias(), "agendada");
    expect(depois.resultado).toBe("concluida");
    expect((await lerFotoDaSincronizacao(a.banco)).estado).toMatchObject({
      erroCodigo: null,
      falhasDeLimiteSeguidas: 0,
      pausaAte: null,
    });
  });

  it("429 seguidos dobram a espera, com teto de 6 horas", async () => {
    const a = montarAmbiente();
    a.garmin.forcarFalha("dailysummaries", { status: 429 });
    const esperas: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const antes = a.agora();
      await sincronizar(a.dependencias(), "agendada");
      const foto = await lerFotoDaSincronizacao(a.banco);
      esperas.push((Date.parse(foto.estado?.pausaAte ?? "") - antes) / 1000);
      a.avancar(7 * 3_600_000);
    }
    expect(esperas.slice(0, 4).map((s) => Math.round(s / 60))).toEqual([15, 30, 60, 120]);
    expect(Math.max(...esperas)).toBeLessThanOrEqual(21_600 + 60);
  });
});

describe("outros erros", () => {
  it("5xx e falha de rede: código curto, tenta de novo no próximo cron, nada é inventado", async () => {
    const a = montarAmbiente();
    a.garmin.forcarFalha("activitylist-service", { status: 503, vezes: 1 });
    await sincronizar(a.dependencias(), "agendada");
    expect((await lerFotoDaSincronizacao(a.banco)).estado?.erroCodigo).toBe("garmin_indisponivel");

    a.avancar(QUINZE_MINUTOS);
    await sincronizar(a.dependencias(), "agendada");
    expect((await lerFotoDaSincronizacao(a.banco)).estado?.erroCodigo).toBeNull();
  });

  it("resposta fora do formato para só aquele fluxo e não grava nada dele", async () => {
    const a = montarAmbiente({
      dados: {
        atividades: [
          atividadeBruta(1, "2026-07-01"),
          atividadeBruta(2, "2026-07-20", { duration: "muito" }),
        ],
        diasDeSaude: ["2026-07-02"],
      },
    });
    await sincronizar(a.dependencias(), "agendada");
    a.avancar(QUINZE_MINUTOS);
    await sincronizar(a.dependencias(), "agendada"); // a 2ª janela de atividades é a quebrada
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.estado?.erroCodigo).toBe("formato_inesperado");
    const atividades = foto.progresso.find((p) => p.fluxo === "atividades");
    expect(atividades?.importadoAte).toBe("2026-07-14"); // parou antes da janela com o problema
    expect(a.memoria.despejo()).not.toContain("muito");
    expect(a.memoria.despejo()).not.toContain('"id":2,'); // a atividade quebrada não entrou
    // Os outros fluxos seguiram.
    expect(foto.progresso.find((p) => p.fluxo === "sono")?.importadoAte).not.toBeNull();
    expect(a.eventos).toContainEqual(
      expect.objectContaining({ evento: "formato_inesperado", onde: "atividades" }),
    );
  });
});
