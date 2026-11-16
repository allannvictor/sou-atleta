import {
  atividade,
  diaHrv,
  diaResumo,
  diaSono,
  lerFotoDaSincronizacao,
  perfilTreino,
  zonaFc,
  type Fluxo,
  type ProgressoDoFluxo,
} from "@sou-atleta/db";
import { atividadeBruta, diasSeguidos } from "@sou-atleta/garmin/teste";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ORCAMENTO, SUBREQUESTS_MAXIMOS } from "./limites.js";
import {
  prepararExecucao,
  proximaJanela,
  proximoFluxo,
  resultadoParaOSite,
  sincronizar,
} from "./sincronizar.js";
import {
  dentroDosNoventaDias,
  historicoSintetico,
  HOJE,
  INICIO_DA_IMPORTACAO,
  montarAmbiente,
  ONZE_MINUTOS,
} from "./teste/ambiente.js";

type Ambiente = ReturnType<typeof montarAmbiente>;

/** Quantas linhas cada tabela tem. */
async function contagens(a: Ambiente) {
  const [ativ, sono, hrv, resumo, zonas, perfil] = await Promise.all([
    a.banco.select().from(atividade),
    a.banco.select().from(diaSono),
    a.banco.select().from(diaHrv),
    a.banco.select().from(diaResumo),
    a.banco.select().from(zonaFc),
    a.banco.select().from(perfilTreino),
  ]);
  return {
    atividades: ativ.length,
    sono: sono.length,
    hrv: hrv.length,
    resumo: resumo.length,
    zonas: zonas.length,
    perfil: perfil.length,
  };
}

const dados = historicoSintetico();
const ATIVIDADES_NOS_90_DIAS = dados.atividades.filter((a) =>
  dentroDosNoventaDias(String(a["startTimeLocal"]).slice(0, 10)),
).length;
const DIAS_NOS_90_DIAS = dados.diasDeSaude.filter(dentroDosNoventaDias).length;
const COMPLETO = {
  atividades: ATIVIDADES_NOS_90_DIAS,
  sono: DIAS_NOS_90_DIAS,
  hrv: DIAS_NOS_90_DIAS,
  resumo: DIAS_NOS_90_DIAS,
  zonas: 1,
  perfil: 1,
};

/** Abre a página várias vezes, até os 90 dias terminarem (ou estourar o limite de segurança). */
async function abrirAteCompletar(a: Ambiente, maximo = 60) {
  const gastos: number[] = [];
  for (let i = 0; i < maximo; i += 1) {
    const antes = a.subrequestsReais();
    const resumo = await sincronizar(a.dependencias(), "ao_abrir");
    gastos.push(a.subrequestsReais() - antes);
    expect(resumo.subrequests).toBeLessThanOrEqual(SUBREQUESTS_MAXIMOS);
    a.avancar(ONZE_MINUTOS);
    const foto = await lerFotoDaSincronizacao(a.banco);
    if (foto.progresso.length === 4 && foto.progresso.every((p) => p.historicoCompleto)) break;
  }
  return gastos;
}

describe("importação inicial: só os últimos 90 dias", () => {
  it("cada abertura traz o próximo pedaço, em vários lotes, sem passar de 50 subrequests", async () => {
    const a = montarAmbiente();
    const primeira = await sincronizar(a.dependencias(), "ao_abrir");
    expect(primeira.janelas).toBeLessThanOrEqual(ORCAMENTO.ao_abrir.janelas);
    const depoisDaPrimeira = await lerFotoDaSincronizacao(a.banco);
    expect(depoisDaPrimeira.progresso.some((p) => !p.historicoCompleto)).toBe(true); // ainda trazendo

    a.avancar(ONZE_MINUTOS);
    const gastos = await abrirAteCompletar(a);
    expect(gastos.length).toBeGreaterThan(5);
    // Limite do plano gratuito: 50 subrequests por execução (fetch + D1), medidos de verdade.
    for (const gasto of gastos) expect(gasto).toBeLessThanOrEqual(50);

    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.progresso).toHaveLength(4);
    expect(foto.progresso.every((p) => p.historicoCompleto && p.importadoAte === HOJE)).toBe(true);
    expect(foto.progresso.every((p) => p.inicio === INICIO_DA_IMPORTACAO)).toBe(true);
    expect(await contagens(a)).toEqual(COMPLETO);
  });

  it("nada anterior aos 90 dias é pedido nem guardado", async () => {
    const a = montarAmbiente();
    await abrirAteCompletar(a);
    const pedidos = a.garmin.requisicoes.flatMap((r) => [
      r.consulta["startDate"],
      /\/(\d{4}-\d{2}-\d{2})\//.exec(r.caminho)?.[1],
    ]);
    for (const data of pedidos.filter((d): d is string => d !== undefined)) {
      expect(data >= INICIO_DA_IMPORTACAO, data).toBe(true);
    }
    const guardadas = await a.banco.select({ dia: atividade.dataLocal }).from(atividade);
    expect(guardadas.every((l) => l.dia >= INICIO_DA_IMPORTACAO)).toBe(true);
    const sono = await a.banco.select({ dia: diaSono.data }).from(diaSono);
    expect(sono.every((l) => l.dia >= INICIO_DA_IMPORTACAO)).toBe(true);
    // E o conector nunca vai atrás da "primeira atividade" da conta.
    expect(
      a.garmin.requisicoes.some(
        (r) => r.consulta["sortOrder"] === "asc" && r.consulta["limit"] === "1",
      ),
    ).toBe(false);
  });

  it("nenhuma janela da importação é pedida duas vezes, e repetir depois não duplica linhas", async () => {
    const a = montarAmbiente();
    await abrirAteCompletar(a);
    const doSono = a.garmin.requisicoes
      .filter((r) => r.caminho.includes("dailySleepSummariesByDate"))
      .map((r) => r.consulta["startDate"] ?? "");
    const doPeriodo = doSono.filter((inicio) => inicio < "2026-11-10");
    expect(new Set(doPeriodo).size).toBe(doPeriodo.length);

    await sincronizar(a.dependencias(), "ao_abrir");
    expect(await contagens(a)).toEqual(COMPLETO);
  });

  it("interrompida no meio (falha no banco), a próxima abertura retoma sem duplicar nem pular", async () => {
    const a = montarAmbiente();
    await sincronizar(a.dependencias(), "ao_abrir");
    const antes = await lerFotoDaSincronizacao(a.banco);
    expect(antes.progresso.some((p) => p.importadoAte !== null)).toBe(true);

    // O banco falha ao gravar uma janela: o lote é desfeito por inteiro, com o progresso junto.
    const original = a.memoria.d1.batch.bind(a.memoria.d1);
    let lotes = 0;
    (a.memoria.d1 as { batch: unknown }).batch = (...args: Parameters<typeof original>) => {
      lotes += 1;
      // O 1º lote é a leitura do estado; o 2º, a primeira janela.
      return lotes === 2 ? Promise.reject(new Error("D1 caiu")) : original(...args);
    };
    a.avancar(ONZE_MINUTOS);
    const resumo = await sincronizar(a.dependencias(), "ao_abrir");
    (a.memoria.d1 as { batch: unknown }).batch = original;

    expect(resumo.resultado).toBe("parada_por_erro");
    const depoisDaFalha = await lerFotoDaSincronizacao(a.banco);
    expect(depoisDaFalha.progresso).toEqual(antes.progresso); // nada avançou sem os dados
    expect(depoisDaFalha.estado?.erroCodigo).toBe("erro_interno");

    a.avancar(ONZE_MINUTOS);
    await abrirAteCompletar(a);
    expect(await contagens(a)).toEqual(COMPLETO);
  });

  it("execução cortada sem soltar a trava: a seguinte espera a trava expirar, avisa e segue", async () => {
    const a = montarAmbiente();
    const primeira = await prepararExecucao(a.dependencias(), "ao_abrir");
    expect(primeira.tipo).toBe("pronta"); // pegou a trava e "morreu" sem executar

    a.avancar(60_000);
    expect((await sincronizar(a.dependencias(), "manual")).resultado).toBe("ja_em_andamento");

    a.avancar(6 * 60_000);
    const segunda = await prepararExecucao(a.dependencias(), "manual");
    expect(segunda.tipo).toBe("pronta");
    expect(a.eventos).toContainEqual({ evento: "execucao_anterior_interrompida" });
    // O painel fica sabendo na hora...
    expect((await lerFotoDaSincronizacao(a.banco)).estado?.erroCodigo).toBe(
      "execucao_interrompida",
    );
    // ...e o aviso some quando uma execução termina bem.
    if (segunda.tipo === "pronta") await segunda.executar();
    expect((await lerFotoDaSincronizacao(a.banco)).estado?.erroCodigo).toBeNull();
  });
});

describe("depois dos 90 dias: incremental", () => {
  /** Ambiente com a importação inicial pronta, e um jeito de mudar o que a Garmin devolve. */
  async function pronto() {
    const a = montarAmbiente();
    await abrirAteCompletar(a);
    const duracao = async (id: number) =>
      (await a.banco.select().from(atividade)).find((l) => l.id === id)?.duracaoS;
    return { a, duracao };
  }
  const comEdicoes = (extra: ReturnType<typeof atividadeBruta>[]) => ({
    atividades: [
      ...dados.atividades.filter((x) => !extra.some((e) => e.activityId === x.activityId)),
      ...extra,
    ],
    diasDeSaude: dados.diasDeSaude,
  });

  it("atividade nova entra, e a editada dentro da sobreposição de 3 dias tem o valor novo", async () => {
    const { a, duracao } = await pronto();
    // Uma atividade a cada 3 dias: a de 13/11 (anteontem) está dentro da sobreposição de 3 dias.
    const anteontem = dados.atividades.find((x) =>
      String(x["startTimeLocal"]).startsWith("2026-11-13"),
    );
    expect(anteontem).toBeDefined();
    const id = anteontem?.activityId ?? 0;
    const antes = await duracao(id);
    a.garmin.trocarDados(
      comEdicoes([
        atividadeBruta(id, "2026-11-13", { duration: 9999 }),
        atividadeBruta(9999, HOJE, { duration: 1800 }),
      ]),
    );
    a.avancar(ONZE_MINUTOS);
    await sincronizar(a.dependencias(), "manual");
    expect(antes).not.toBe(9999);
    expect(await duracao(id)).toBe(9999);
    expect(await duracao(9999)).toBe(1800);
  });

  it("atividade antiga, fora da sobreposição, não é relida (continua como estava)", async () => {
    const { a, duracao } = await pronto();
    const antiga = dados.atividades.find((x) =>
      String(x["startTimeLocal"]).startsWith("2026-09-02"),
    );
    const id = antiga?.activityId ?? 0;
    const antes = await duracao(id);
    expect(antes).toBeDefined();
    a.garmin.trocarDados(comEdicoes([atividadeBruta(id, "2026-09-02", { duration: 7777 })]));
    for (let i = 0; i < 4; i += 1) {
      a.avancar(ONZE_MINUTOS);
      await sincronizar(a.dependencias(), "manual");
    }
    expect(await duracao(id)).toBe(antes);
  });

  it("janela com mais de uma página de atividades (45 numa janela) entra inteira, sem duplicar", async () => {
    const muitas = Array.from({ length: 45 }, (_, i) =>
      atividadeBruta(7000 + i, `2026-08-${String(18 + (i % 10)).padStart(2, "0")}`),
    );
    const a = montarAmbiente({
      dados: { atividades: muitas, diasDeSaude: diasSeguidos("2026-08-17", 91) },
    });
    await abrirAteCompletar(a);
    const linhas = await a.banco.select({ id: atividade.id }).from(atividade);
    expect(linhas).toHaveLength(45);
    expect(new Set(linhas.map((l) => l.id)).size).toBe(45);
    const paginas = a.garmin.requisicoes.filter(
      (r) => r.consulta["startDate"] === "2026-08-17" && r.caminho.includes("activities"),
    );
    expect(paginas.map((r) => r.consulta["start"])).toEqual(["0", "20", "40"]);
  });
});

describe("Atualizar agora e o intervalo ao abrir a página", () => {
  it("abrir a página de novo antes de 10 minutos não fala com a Garmin; o botão fala", async () => {
    const a = montarAmbiente();
    await abrirAteCompletar(a);
    await sincronizar(a.dependencias(), "ao_abrir"); // uma abertura "agora"
    const pedidos = a.garmin.requisicoes.length;

    a.avancar(5 * 60_000);
    const aoAbrir = await sincronizar(a.dependencias(), "ao_abrir");
    expect(aoAbrir.resultado).toBe("muito_cedo");
    expect(a.garmin.requisicoes).toHaveLength(pedidos);

    const botao = await sincronizar(a.dependencias(), "manual");
    expect(botao.resultado).toBe("concluida");
    expect(a.garmin.requisicoes.length).toBeGreaterThan(pedidos);
  });

  it("o botão busca de verdade, mesmo logo depois de uma execução: treino novo aparece", async () => {
    const a = montarAmbiente();
    await abrirAteCompletar(a);
    await sincronizar(a.dependencias(), "ao_abrir"); // uma abertura "agora"
    const ultimoAntes = (await lerFotoDaSincronizacao(a.banco)).estado?.ultimoSucessoEm;

    a.garmin.trocarDados({
      atividades: [...dados.atividades, atividadeBruta(8888, HOJE, { duration: 1500 })],
      diasDeSaude: dados.diasDeSaude,
    });
    a.avancar(2 * 60_000); // só 2 minutos depois
    const resumo = await sincronizar(a.dependencias(), "manual");
    expect(resumo).toMatchObject({ resultado: "concluida", buscouDados: true });
    expect(resultadoParaOSite(resumo)).toBe("atualizada");

    const ids = (await a.banco.select({ id: atividade.id }).from(atividade)).map((l) => l.id);
    expect(ids).toContain(8888);
    const ultimoDepois = (await lerFotoDaSincronizacao(a.banco)).estado?.ultimoSucessoEm;
    expect(Date.parse(ultimoDepois ?? "")).toBeGreaterThan(Date.parse(ultimoAntes ?? ""));
  });

  it("'Última atualização' só anda quando algo foi de fato buscado", async () => {
    const a = montarAmbiente();
    await sincronizar(a.dependencias(), "ao_abrir");
    const antes = (await lerFotoDaSincronizacao(a.banco)).estado;
    expect(antes?.ultimoSucessoEm).not.toBeNull();

    // Tudo falha: nada é buscado, então a última atualização fica onde estava, mas a tentativa
    // é registrada.
    a.garmin.forcarFalha("", { status: 503 });
    a.avancar(ONZE_MINUTOS);
    const resumo = await sincronizar(a.dependencias(), "ao_abrir");
    expect(resumo).toMatchObject({ resultado: "parada_por_erro", buscouDados: false });
    const depois = (await lerFotoDaSincronizacao(a.banco)).estado;
    expect(depois?.ultimoSucessoEm).toBe(antes?.ultimoSucessoEm);
    expect(Date.parse(depois?.ultimaExecucaoEm ?? "")).toBeGreaterThan(
      Date.parse(antes?.ultimaExecucaoEm ?? ""),
    );
  });

  it("execução ignorada (muito cedo, pausa, sem chave) nunca mexe em 'última atualização'", async () => {
    const a = montarAmbiente();
    await sincronizar(a.dependencias(), "ao_abrir");
    const antes = (await lerFotoDaSincronizacao(a.banco)).estado;
    a.avancar(30_000);
    expect((await sincronizar(a.dependencias(), "ao_abrir")).resultado).toBe("muito_cedo");
    expect((await sincronizar(a.dependencias(), "manual")).resultado).toBe("muito_cedo");
    const depois = (await lerFotoDaSincronizacao(a.banco)).estado;
    expect(depois?.ultimoSucessoEm).toBe(antes?.ultimoSucessoEm);
    expect(depois?.ultimaExecucaoEm).toBe(antes?.ultimaExecucaoEm);
  });

  it("o botão usa no máximo o orçamento dele e responde por palavras que o site conhece", async () => {
    const a = montarAmbiente();
    const primeira = await prepararExecucao(a.dependencias(), "manual");
    expect(primeira.tipo).toBe("pronta");
    if (primeira.tipo === "pronta") {
      const resumo = await primeira.executar();
      expect(resumo.requisicoesGarmin).toBeLessThanOrEqual(ORCAMENTO.manual.garmin);
      expect(resultadoParaOSite(resumo)).toBe("atualizada");
    }
  });
});

describe("regras de janela e de rodízio", () => {
  const p = (extra: Partial<ProgressoDoFluxo> = {}): ProgressoDoFluxo => ({
    fluxo: "sono",
    inicio: "2026-08-17",
    importadoAte: null,
    historicoCompleto: false,
    verificadoEm: null,
    ...extra,
  });

  it("começa no início e anda de janela em janela, sem passar de hoje", () => {
    expect(proximaJanela(p(), HOJE)).toEqual({ de: "2026-08-17", ate: "2026-08-26" });
    expect(proximaJanela(p({ importadoAte: "2026-08-26" }), HOJE)).toEqual({
      de: "2026-08-27",
      ate: "2026-09-05",
    });
    expect(proximaJanela(p({ importadoAte: "2026-11-12" }), HOJE)).toEqual({
      de: "2026-11-13",
      ate: HOJE,
    });
  });

  it("depois da importação inicial, volta alguns dias para pegar o que foi editado", () => {
    expect(proximaJanela(p({ importadoAte: HOJE, historicoCompleto: true }), HOJE)).toEqual({
      de: "2026-11-13",
      ate: HOJE,
    });
  });

  it("ordem: quem não completou os 90 dias primeiro; depois atividades; depois o verificado há mais tempo", () => {
    const todos = (
      por: Partial<Record<Fluxo, { verificadoEm?: string | null; historicoCompleto?: boolean }>>,
    ) =>
      new Map<Fluxo, ProgressoDoFluxo>(
        (["atividades", "resumo_diario", "sono", "hrv"] as const).map((fluxo) => [
          fluxo,
          p({ fluxo, ...por[fluxo] }),
        ]),
      );
    const vazio = new Set<Fluxo>();
    // Tudo novo: atividades primeiro (vale ao abrir a página e no botão: não há mais "modo").
    expect(proximoFluxo(todos({}), vazio)).toBe("atividades");
    // Atividades já completas e os outros não: os incompletos vêm antes, o mais antigo primeiro.
    expect(
      proximoFluxo(
        todos({
          atividades: { historicoCompleto: true, verificadoEm: "2026-11-15T08:00Z" },
          resumo_diario: { verificadoEm: "2026-11-15T10:00Z" },
          sono: { verificadoEm: "2026-11-15T11:00Z" },
          hrv: { verificadoEm: "2026-11-15T09:00Z" },
        }),
        vazio,
      ),
    ).toBe("hrv");
    // Todos completos: atividades primeiro, mesmo sendo a verificada mais recentemente.
    expect(
      proximoFluxo(
        todos({
          atividades: { historicoCompleto: true, verificadoEm: "2026-11-15T12:00Z" },
          resumo_diario: { historicoCompleto: true, verificadoEm: "2026-11-15T09:00Z" },
          sono: { historicoCompleto: true, verificadoEm: "2026-11-15T11:00Z" },
          hrv: { historicoCompleto: true, verificadoEm: "2026-11-15T08:00Z" },
        }),
        vazio,
      ),
    ).toBe("atividades");
    // Um fluxo já feito nesta execução não volta; sem candidatos, nada.
    expect(
      proximoFluxo(todos({}), new Set(["atividades", "resumo_diario", "sono", "hrv"])),
    ).toBeNull();
  });

  it("ao abrir a página, as atividades são a primeira janela de TODA execução", async () => {
    const a = montarAmbiente();
    for (let i = 0; i < 3; i += 1) {
      const antes = a.garmin.requisicoes.length;
      await sincronizar(a.dependencias(), "ao_abrir");
      const novas = a.garmin.requisicoes.slice(antes).filter((r) => r.metodo === "GET");
      const primeiraDeDados = novas.find(
        (r) => !r.caminho.includes("userprofile") && !r.caminho.includes("heartRateZones"),
      );
      expect(primeiraDeDados?.caminho, `execução ${String(i + 1)}`).toContain("activities");
      a.avancar(ONZE_MINUTOS);
    }
  });

  it("os 90 dias levam 28 janelas e, a 2 por execução, 15 aberturas (ou 15 cliques)", async () => {
    for (const modo of ["ao_abrir", "manual"] as const) {
      const a = montarAmbiente();
      let execucoes = 0;
      let janelas = 0;
      for (; execucoes < 40;) {
        const resumo = await sincronizar(a.dependencias(), modo);
        execucoes += 1;
        janelas += resumo.janelas;
        a.avancar(ONZE_MINUTOS);
        const foto = await lerFotoDaSincronizacao(a.banco);
        if (foto.progresso.length === 4 && foto.progresso.every((x) => x.historicoCompleto)) break;
      }
      expect(janelas, modo).toBeGreaterThanOrEqual(28); // 7 de atividades, 4 de resumo, 10 de sono, 7 de HRV (+ vaga que sobra no fim)
      expect(execucoes, modo).toBe(15);
    }
  });

  it("a tentativa é registrada ao pegar a trava: execução cortada também segura a seguinte", async () => {
    const a = montarAmbiente();
    const primeira = await prepararExecucao(a.dependencias(), "ao_abrir");
    expect(primeira.tipo).toBe("pronta"); // pegou a trava e "morreu" (como num corte por CPU)
    const estado = (await lerFotoDaSincronizacao(a.banco)).estado;
    expect(estado?.ultimaExecucaoEm).toBe(new Date(a.agora()).toISOString());
    // Passou a trava de 5 min, mas ainda não os 10 min: abrir a página não tenta de novo.
    a.avancar(6 * 60_000);
    expect((await sincronizar(a.dependencias(), "ao_abrir")).resultado).toBe("muito_cedo");
    expect(a.garmin.requisicoes).toHaveLength(0);
    a.avancar(5 * 60_000);
    expect((await sincronizar(a.dependencias(), "ao_abrir")).resultado).toBe("concluida");
  });
});

describe("item inválido não derruba a janela", () => {
  it("o item é descartado e contado, a janela avança e o resto entra", async () => {
    const a = montarAmbiente({
      dados: {
        atividades: [
          atividadeBruta(1, "2026-08-18"),
          atividadeBruta(2, "2026-08-19", { duration: "muito-secreto" }),
          atividadeBruta(3, "2026-08-20"),
        ],
        diasDeSaude: diasSeguidos("2026-08-17", 91),
      },
    });
    await abrirAteCompletar(a);
    const ids = (await a.banco.select({ id: atividade.id }).from(atividade)).map((l) => l.id);
    expect(ids.sort()).toEqual([1, 3]);
    expect(a.eventos).toContainEqual({
      evento: "itens_descartados",
      fluxo: "atividades",
      quantidade: 1,
    });
    expect(JSON.stringify(a.eventos)).not.toContain("muito-secreto");
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.progresso.every((x) => x.historicoCompleto)).toBe(true);
    expect(foto.estado?.erroCodigo).toBeNull(); // não é erro: foi um item isolado
    expect(foto.estado?.itensIgnorados).toBe(1); // mas fica registrado, para o quadro avisar
  });

  it("a contagem soma itens descartados de janelas diferentes, sem contar a mesma janela duas vezes", async () => {
    const a = montarAmbiente({
      dados: {
        atividades: [
          atividadeBruta(1, "2026-08-18", { duration: "x" }),
          atividadeBruta(2, "2026-08-19", { duration: "y" }),
          atividadeBruta(3, "2026-10-20", { duration: "z" }),
          atividadeBruta(4, "2026-10-21"),
        ],
        diasDeSaude: diasSeguidos("2026-08-17", 91),
      },
    });
    await abrirAteCompletar(a);
    await sincronizar(a.dependencias(), "manual"); // relê os últimos dias: não recontar o antigo
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.estado?.itensIgnorados).toBe(3);
  });

  it("janela com mais de 20 atividades e um item inválido na PRIMEIRA página importa todas as páginas", async () => {
    const muitas = Array.from({ length: 45 }, (_, i) =>
      atividadeBruta(
        7000 + i,
        `2026-08-${String(18 + (i % 10)).padStart(2, "0")}`,
        i === 0 ? { duration: "muito" } : {},
      ),
    );
    const a = montarAmbiente({
      dados: { atividades: muitas, diasDeSaude: diasSeguidos("2026-08-17", 91) },
    });
    await abrirAteCompletar(a);
    const ids = (await a.banco.select({ id: atividade.id }).from(atividade)).map((l) => l.id);
    expect(ids).toHaveLength(44); // 45 menos o inválido: nenhuma página ficou para trás
    expect(ids).not.toContain(7000);
    const paginas = a.garmin.requisicoes.filter(
      (r) => r.consulta["startDate"] === "2026-08-17" && r.caminho.includes("activities"),
    );
    expect(paginas.map((r) => r.consulta["start"])).toEqual(["0", "20", "40"]);
    expect((await lerFotoDaSincronizacao(a.banco)).estado?.itensIgnorados).toBe(1);
  });
});

describe("orçamento por execução (propriedade)", () => {
  it("qualquer tamanho de dados, nos dois modos, fica abaixo de 50 subrequests por execução", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 90 }),
        fc.integer({ min: 0, max: 200 }),
        fc.constantFrom("ao_abrir" as const, "manual" as const),
        async (nAtividades, nDias, modo) => {
          const dias = diasSeguidos("2026-08-17", 91);
          const a = montarAmbiente({
            dados: {
              atividades: dias.slice(0, nAtividades).map((d, i) => atividadeBruta(5000 + i, d)),
              diasDeSaude: diasSeguidos("2026-08-17", Math.min(nDias, 91)),
            },
          });
          for (let i = 0; i < 4; i += 1) {
            const antes = a.subrequestsReais();
            await sincronizar(a.dependencias(), modo);
            expect(a.subrequestsReais() - antes).toBeLessThanOrEqual(50);
            a.avancar(ONZE_MINUTOS);
          }
        },
      ),
      { numRuns: 12 },
    );
  });

  it("conta sem nenhuma atividade ainda sincroniza a saúde dos últimos 90 dias", async () => {
    const a = montarAmbiente({
      dados: { atividades: [], diasDeSaude: diasSeguidos("2026-08-01", 107) },
    });
    await abrirAteCompletar(a);
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.progresso.every((x) => x.historicoCompleto)).toBe(true);
    expect((await contagens(a)).sono).toBe(91);
  });
});
