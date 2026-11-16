import {
  atividade,
  diaHrv,
  diaResumo,
  diaSono,
  lerFotoDaSincronizacao,
  perfilTreino,
  zonaFc,
} from "@sou-atleta/db";
import { atividadeBruta, diasSeguidos } from "@sou-atleta/garmin/teste";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ORCAMENTO, SUBREQUESTS_MAXIMOS } from "./limites.js";
import { deveProcessar, prepararExecucao, proximaJanela, sincronizar } from "./sincronizar.js";
import { HOJE, montarAmbiente, QUINZE_MINUTOS } from "./teste/ambiente.js";

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

const COMPLETO = { atividades: 46, sono: 198, hrv: 198, resumo: 198, zonas: 1, perfil: 1 };

/** Roda o cron até todos os fluxos terminarem o histórico (ou estourar o limite de segurança). */
async function rodarAteCompletar(a: Ambiente, maximo = 80) {
  const gastos: number[] = [];
  for (let i = 0; i < maximo; i += 1) {
    const antes = a.subrequestsReais();
    const resumo = await sincronizar(a.dependencias(), "agendada");
    gastos.push(a.subrequestsReais() - antes);
    expect(resumo.subrequests).toBeLessThanOrEqual(SUBREQUESTS_MAXIMOS);
    a.avancar(QUINZE_MINUTOS);
    const foto = await lerFotoDaSincronizacao(a.banco);
    if (foto.progresso.length === 4 && foto.progresso.every((p) => p.historicoCompleto)) break;
  }
  return gastos;
}

describe("importação do histórico", () => {
  it("importa tudo em vários lotes, sem passar de 50 subrequests por execução", async () => {
    const a = montarAmbiente();
    const gastos = await rodarAteCompletar(a);

    expect(gastos.length).toBeGreaterThan(5); // mais de um lote
    // Limite do plano gratuito: 50 subrequests por execução (fetch + D1), medidos de verdade.
    for (const gasto of gastos) expect(gasto).toBeLessThanOrEqual(50);

    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.progresso).toHaveLength(4);
    expect(foto.progresso.every((p) => p.historicoCompleto && p.importadoAte === HOJE)).toBe(true);
    expect(await contagens(a)).toEqual(COMPLETO);
  });

  it("nenhuma janela do histórico é pedida duas vezes, e repetir depois não duplica linhas", async () => {
    const a = montarAmbiente();
    await rodarAteCompletar(a);
    const pedidos = a.garmin.requisicoes
      .filter((r) => r.caminho.includes("dailySleepSummariesByDate"))
      .map((r) => r.consulta["startDate"] ?? "");
    // Só as janelas incrementais (últimos dias) podem repetir; as do histórico não.
    const doHistorico = pedidos.filter((inicio) => inicio < "2026-11-10");
    expect(new Set(doHistorico).size).toBe(doHistorico.length);

    a.avancar(2 * 3_600_000);
    await sincronizar(a.dependencias(), "agendada");
    expect(await contagens(a)).toEqual(COMPLETO);
  });

  it("interrompida no meio (falha no banco), a próxima execução retoma sem duplicar nem pular", async () => {
    const a = montarAmbiente();
    await sincronizar(a.dependencias(), "agendada");
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
    a.avancar(QUINZE_MINUTOS);
    const resumo = await sincronizar(a.dependencias(), "agendada");
    (a.memoria.d1 as { batch: unknown }).batch = original;

    expect(resumo.resultado).toBe("parada_por_erro");
    const depoisDaFalha = await lerFotoDaSincronizacao(a.banco);
    expect(depoisDaFalha.progresso).toEqual(antes.progresso); // nada avançou sem os dados
    expect(depoisDaFalha.estado?.erroCodigo).toBe("erro_interno");

    await rodarAteCompletar(a);
    expect(await contagens(a)).toEqual(COMPLETO);
  });

  it("execução cortada sem soltar a trava: a seguinte espera a trava expirar e segue", async () => {
    const a = montarAmbiente();
    const primeira = await prepararExecucao(a.dependencias(), "agendada");
    expect(primeira.tipo).toBe("pronta"); // pegou a trava e "morreu" sem executar

    a.avancar(60_000);
    expect((await sincronizar(a.dependencias(), "agendada")).resultado).toBe("ja_em_andamento");

    a.avancar(6 * 60_000);
    expect((await sincronizar(a.dependencias(), "agendada")).resultado).toBe("concluida");
    expect(a.eventos).toContainEqual({ evento: "execucao_anterior_interrompida" });
  });

  it("atividade nova e atividade editada depois do histórico entram na rotina incremental", async () => {
    const a = montarAmbiente();
    await rodarAteCompletar(a);

    a.garmin.trocarDados({
      atividades: [
        atividadeBruta(9999, HOJE, { duration: 1800 }), // nova
        atividadeBruta(1000, "2026-07-01", { duration: 4242 }), // antiga, já importada
      ],
      diasDeSaude: diasSeguidos("2026-05-02", 198),
    });
    a.avancar(30 * 60_000);
    await sincronizar(a.dependencias(), "agendada");
    const ids = (await a.banco.select({ id: atividade.id }).from(atividade)).map((l) => l.id);
    expect(ids).toContain(9999);
  });
});

describe("regras de janela", () => {
  const p = (extra: Partial<Parameters<typeof proximaJanela>[0]> = {}) => ({
    fluxo: "sono" as const,
    inicio: "2026-01-01",
    importadoAte: null,
    historicoCompleto: false,
    verificadoEm: null,
    ...extra,
  });

  it("começa no início e anda de janela em janela, sem passar de hoje", () => {
    expect(proximaJanela(p(), HOJE)).toEqual({ de: "2026-01-01", ate: "2026-01-10" });
    expect(proximaJanela(p({ importadoAte: "2026-01-10" }), HOJE)).toEqual({
      de: "2026-01-11",
      ate: "2026-01-20",
    });
    expect(proximaJanela(p({ importadoAte: "2026-11-12" }), HOJE)).toEqual({
      de: "2026-11-13",
      ate: HOJE,
    });
  });

  it("depois do histórico, volta alguns dias para pegar o que foi editado", () => {
    expect(proximaJanela(p({ importadoAte: HOJE, historicoCompleto: true }), HOJE)).toEqual({
      de: "2026-11-13",
      ate: HOJE,
    });
  });

  it("só reconsulta um fluxo completo depois do intervalo, ou quando vira o dia", () => {
    const completo = p({
      historicoCompleto: true,
      importadoAte: HOJE,
      verificadoEm: `${HOJE}T12:00:00.000Z`,
    });
    expect(deveProcessar(completo, HOJE, Date.parse(`${HOJE}T12:30:00Z`))).toBe(false);
    expect(deveProcessar(completo, HOJE, Date.parse(`${HOJE}T13:00:00Z`))).toBe(true);
    expect(deveProcessar(completo, "2026-11-16", Date.parse(`${HOJE}T12:30:00Z`))).toBe(true);
    expect(deveProcessar(p(), HOJE, 0)).toBe(true);
  });
});

describe("botão Atualizar agora", () => {
  it("recusa repetir antes de 60 s e usa menos requisições que o cron", async () => {
    const a = montarAmbiente();
    const primeira = await prepararExecucao(a.dependencias(), "manual");
    expect(primeira.tipo).toBe("pronta");
    if (primeira.tipo === "pronta") {
      const resumo = await primeira.executar();
      expect(resumo.requisicoesGarmin).toBeLessThanOrEqual(ORCAMENTO.manual.garmin);
    }
    a.avancar(10_000);
    expect(await prepararExecucao(a.dependencias(), "manual")).toEqual({
      tipo: "ignorada",
      motivo: "muito_cedo",
    });

    a.avancar(61_000);
    expect((await prepararExecucao(a.dependencias(), "manual")).tipo).toBe("pronta");
  });
});

describe("orçamento por execução (propriedade)", () => {
  it("qualquer tamanho de histórico, em qualquer modo, fica abaixo de 50 subrequests por execução", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 90 }),
        fc.integer({ min: 0, max: 200 }),
        fc.constantFrom("agendada" as const, "manual" as const),
        async (nAtividades, nDias, modo) => {
          const dias = diasSeguidos("2026-07-01", 138);
          const a = montarAmbiente({
            dados: {
              atividades: dias.slice(0, nAtividades).map((d, i) => atividadeBruta(5000 + i, d)),
              diasDeSaude: diasSeguidos("2026-05-02", nDias),
            },
          });
          for (let i = 0; i < 4; i += 1) {
            const antes = a.subrequestsReais();
            await sincronizar(a.dependencias(), modo);
            expect(a.subrequestsReais() - antes).toBeLessThanOrEqual(50);
            a.avancar(modo === "manual" ? 61_000 : QUINZE_MINUTOS);
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
    for (let i = 0; i < 14; i += 1) {
      await sincronizar(a.dependencias(), "agendada");
      a.avancar(QUINZE_MINUTOS);
    }
    const foto = await lerFotoDaSincronizacao(a.banco);
    expect(foto.progresso.map((p) => p.inicio)).toEqual(expect.arrayContaining(["2026-08-17"]));
    expect(foto.progresso.every((p) => p.historicoCompleto)).toBe(true);
  });
});
