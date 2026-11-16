import { avisoDaChave, lerFotoDaSincronizacao } from "@sou-atleta/db";
import { atividadeBruta } from "@sou-atleta/garmin/teste";
import { describe, expect, it } from "vitest";

import { resultadoParaOSite, sincronizar } from "./sincronizar.js";
import { HOJE, montarAmbiente, ONZE_MINUTOS } from "./teste/ambiente.js";

const horas = (n: number) => n * 3_600_000;

describe("chave expirada ou revogada", () => {
  it("para, grava 'chave inválida', avisa o dono e segue abrindo com os dados já guardados", async () => {
    const a = montarAmbiente();
    await sincronizar(a.dependencias(), "ao_abrir"); // funciona e guarda dados
    const dadosAntes = a.memoria.despejo();
    expect(dadosAntes).toContain("atividade:");

    a.garmin.revogarChave();
    // O token já emitido vale 24 h no relógio: o fim dele só aparece na hora de renovar.
    a.avancar(25 * 3_600_000);
    const resumo = await sincronizar(a.dependencias(), "ao_abrir");

    expect(resumo.resultado).toBe("parada_por_erro");
    expect(resultadoParaOSite(resumo)).toBe("chave_recusada");
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.estado).toMatchObject({ statusDaChave: "invalida", erroCodigo: "chave_invalida" });
    expect(avisoDaChave(foto.estado, HOJE)).toMatchObject({ tipo: "invalida" });
    // Os dados que já estavam guardados continuam lá.
    expect(a.memoria.despejo().length).toBeGreaterThanOrEqual(dadosAntes.length);
    expect(a.eventos).toContainEqual({ evento: "chave_invalida" });
  });

  it("depois de recusada, abrir a página só tenta de novo daqui a 1 hora; o botão tenta na hora", async () => {
    const a = montarAmbiente();
    a.garmin.revogarChave();
    await sincronizar(a.dependencias(), "ao_abrir");
    const pedidos = a.garmin.requisicoes.length;

    a.avancar(ONZE_MINUTOS);
    expect((await sincronizar(a.dependencias(), "ao_abrir")).resultado).toBe("pausada");
    expect(a.garmin.requisicoes).toHaveLength(pedidos); // nenhuma requisição nova

    a.avancar(70_000);
    const manual = await sincronizar(a.dependencias(), "manual");
    expect(manual.resultado).toBe("parada_por_erro"); // tentou (e a chave segue recusada)
    expect(resultadoParaOSite(manual)).toBe("chave_recusada"); // e o botão diz a verdade
    expect(a.garmin.requisicoes.length).toBe(pedidos + 1);

    a.avancar(horas(2));
    expect((await sincronizar(a.dependencias(), "ao_abrir")).resultado).toBe("parada_por_erro");
  });

  it("com a chave nova funcionando, volta ao normal", async () => {
    const a = montarAmbiente();
    a.garmin.revogarChave();
    await sincronizar(a.dependencias(), "ao_abrir");

    const outro = montarAmbiente();
    // Mesmo banco, Garmin que aceita a chave: simula o dono cadastrar a chave nova.
    const retomado = {
      ...outro.dependencias(),
      banco: a.banco,
      agora: () => new Date(a.agora() + horas(2)),
    };
    const resumo = await sincronizar(retomado, "manual");
    expect(resumo.resultado).toBe("concluida");
    expect((await lerFotoDaSincronizacao(a.banco)).estado).toMatchObject({
      statusDaChave: "ok",
      erroCodigo: null,
      pausaAte: null,
    });
  });
});

describe("token recusado depois de a chave ser aceita: problema do conector, não da chave", () => {
  it("não vira 'chave expirada': código próprio, chave continua ok, aviso honesto", async () => {
    const a = montarAmbiente();
    // A troca da chave por token funciona; as consultas recusam o token (esquema de autorização).
    a.garmin.forcarFalha("userprofile", { status: 401 });
    const resumo = await sincronizar(a.dependencias(), "ao_abrir");

    expect(resumo.resultado).toBe("parada_por_erro");
    expect(resultadoParaOSite(resumo)).toBe("token_recusado");
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.estado).toMatchObject({ statusDaChave: "ok", erroCodigo: "token_recusado" });
    expect(avisoDaChave(foto.estado, HOJE)).not.toMatchObject({ tipo: "invalida" });
    expect(a.eventos).toContainEqual({ evento: "token_recusado" });
    expect(a.eventos).not.toContainEqual({ evento: "chave_invalida" });
  });

  it("abrir a página não insiste (pausa de 1 h); o botão tenta de novo na hora", async () => {
    const a = montarAmbiente();
    a.garmin.forcarFalha("userprofile", { status: 401 });
    await sincronizar(a.dependencias(), "ao_abrir");
    const pedidos = a.garmin.requisicoes.length;
    a.avancar(ONZE_MINUTOS);
    expect((await sincronizar(a.dependencias(), "ao_abrir")).resultado).toBe("pausada");
    expect(a.garmin.requisicoes).toHaveLength(pedidos);
    a.avancar(70_000);
    expect(resultadoParaOSite(await sincronizar(a.dependencias(), "manual"))).toBe(
      "token_recusado",
    );
    expect(a.garmin.requisicoes.length).toBeGreaterThan(pedidos);
  });

  it("troca de token com formato desconhecido fica registrada como problema 'token', não do perfil", async () => {
    const a = montarAmbiente();
    a.garmin.corpoDoTokenEstranho({ outro: "formato" });
    const resumo = await sincronizar(a.dependencias(), "ao_abrir");
    expect(resumo.resultado).toBe("parada_por_erro");
    expect(a.eventos).toContainEqual(
      expect.objectContaining({ evento: "formato_inesperado", onde: "token" }),
    );
    expect((await lerFotoDaSincronizacao(a.banco)).estado?.erroCodigo).toBe("formato_inesperado");
  });
});

describe("chave que não está no cofre ou veio mal colada", () => {
  it("ausente: nenhuma requisição à Garmin e aviso claro", async () => {
    const a = montarAmbiente({ chave: "ausente" });
    const resumo = await sincronizar(a.dependencias(), "ao_abrir");
    expect(resumo.resultado).toBe("sem_chave");
    expect(resultadoParaOSite(resumo)).toBe("sem_chave");
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
      await sincronizar(a.dependencias(), "ao_abrir");
      const foto = await lerFotoDaSincronizacao(a.banco);
      expect(avisoDaChave(foto.estado, HOJE), venceEm).toEqual(esperado);
    }
  });

  it("sem data de vencimento cadastrada, pede a data", async () => {
    const a = montarAmbiente({ venceEm: null });
    await sincronizar(a.dependencias(), "ao_abrir");
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(avisoDaChave(foto.estado, HOJE)).toEqual({ tipo: "sem_data" });
  });
});

describe("429: esperar em vez de repetir", () => {
  it("para na hora, grava a pausa e não fala com a Garmin até ela passar, nem no botão", async () => {
    const a = montarAmbiente();
    a.garmin.forcarFalha("dailysummaries", { status: 429, cabecalhos: { "Retry-After": "1800" } });
    // Chega ao resumo diário depois de algumas aberturas.
    let resumo = await sincronizar(a.dependencias(), "ao_abrir");
    for (let i = 0; i < 3 && resumo.erroCodigo !== "limite_garmin"; i += 1) {
      a.avancar(ONZE_MINUTOS);
      resumo = await sincronizar(a.dependencias(), "manual");
    }
    expect(resumo.erroCodigo).toBe("limite_garmin");
    expect(resultadoParaOSite(resumo)).toBe("pausada");
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.estado).toMatchObject({ erroCodigo: "limite_garmin", falhasDeLimiteSeguidas: 1 });
    expect(Date.parse(foto.estado?.pausaAte ?? "") - a.agora()).toBeGreaterThanOrEqual(1700_000);
    const tentativas = a.garmin.requisicoes.filter((r) => r.caminho.includes("dailysummaries"));
    expect(tentativas).toHaveLength(1); // uma só tentativa, sem laço

    const pedidos = a.garmin.requisicoes.length;
    a.avancar(ONZE_MINUTOS);
    expect((await sincronizar(a.dependencias(), "ao_abrir")).resultado).toBe("pausada");
    a.avancar(70_000);
    expect((await sincronizar(a.dependencias(), "manual")).resultado).toBe("pausada");
    expect(a.garmin.requisicoes).toHaveLength(pedidos);

    a.garmin.limparFalhas();
    a.avancar(horas(1));
    expect((await sincronizar(a.dependencias(), "ao_abrir")).resultado).toBe("concluida");
    expect((await lerFotoDaSincronizacao(a.banco)).estado).toMatchObject({
      erroCodigo: null,
      falhasDeLimiteSeguidas: 0,
      pausaAte: null,
    });
  });

  it("429 seguidos dobram a espera, com teto de 6 horas", async () => {
    const a = montarAmbiente();
    a.garmin.forcarFalha("", { status: 429 });
    const esperas: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const antes = a.agora();
      await sincronizar(a.dependencias(), "ao_abrir");
      const foto = await lerFotoDaSincronizacao(a.banco);
      esperas.push((Date.parse(foto.estado?.pausaAte ?? "") - antes) / 1000);
      a.avancar(7 * 3_600_000);
    }
    expect(esperas.slice(0, 4).map((s) => Math.round(s / 60))).toEqual([15, 30, 60, 120]);
    expect(Math.max(...esperas)).toBeLessThanOrEqual(21_600 + 60);
  });
});

describe("outros erros", () => {
  it("5xx: código curto, tenta de novo na próxima abertura, e o botão diz que a Garmin está fora", async () => {
    const a = montarAmbiente();
    a.garmin.forcarFalha("activitylist-service", { status: 503, vezes: 1 });
    const falhou = await sincronizar(a.dependencias(), "manual");
    expect(resultadoParaOSite(falhou)).toBe("garmin_fora");
    expect((await lerFotoDaSincronizacao(a.banco)).estado?.erroCodigo).toBe("garmin_indisponivel");

    a.avancar(ONZE_MINUTOS);
    await sincronizar(a.dependencias(), "ao_abrir");
    expect((await lerFotoDaSincronizacao(a.banco)).estado?.erroCodigo).toBeNull();
  });

  it("resposta fora do formato para só aquele fluxo e não grava nada dele; os outros seguem", async () => {
    const a = montarAmbiente({
      dados: {
        atividades: [
          atividadeBruta(1, "2026-08-18"),
          atividadeBruta(2, "2026-09-05", { duration: "muito" }),
        ],
        diasDeSaude: ["2026-08-18"],
      },
    });
    for (let i = 0; i < 4; i += 1) {
      await sincronizar(a.dependencias(), "ao_abrir");
      a.avancar(ONZE_MINUTOS);
    }
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.estado?.erroCodigo).toBe("formato_inesperado");
    const atividades = foto.progresso.find((p) => p.fluxo === "atividades");
    expect(atividades?.importadoAte).toBe("2026-08-30"); // parou antes da janela com o problema
    expect(a.memoria.despejo()).not.toContain("muito");
    expect(a.memoria.despejo()).not.toContain('"id":2,'); // a atividade quebrada não entrou
    expect(foto.progresso.find((p) => p.fluxo === "sono")?.importadoAte).not.toBeNull();
    expect(a.eventos).toContainEqual(
      expect.objectContaining({ evento: "formato_inesperado", onde: "atividades" }),
    );
    // Parte dos dados chegou: a execução conta como atualização em parte.
    const resumo = await sincronizar(
      { ...a.dependencias(), agora: () => new Date(a.agora() + 1) },
      "manual",
    );
    expect(resultadoParaOSite(resumo)).toBe("atualizada_em_parte");
  });
});
