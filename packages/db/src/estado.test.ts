import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { criarBanco } from "./banco.js";
import {
  avisoDaChave,
  diasEntre,
  hojeNoFuso,
  lerFotoDaSincronizacao,
  lerFotoGarantindoEstado,
  tentarPegarTrava,
  registrarFimDaExecucao,
} from "./estado.js";
import type { StatusDaChave } from "./esquema.js";
import { criarD1EmMemoria } from "./teste/d1-em-memoria.js";

describe("aviso de vencimento da chave", () => {
  const estado = (chaveVenceEm: string | null, statusDaChave: StatusDaChave = "ok") => ({
    statusDaChave,
    chaveVenceEm,
  });

  it("14 dias ou menos: avisa; 15 dias: não avisa", () => {
    expect(avisoDaChave(estado("2026-11-29"), "2026-11-15")).toEqual({ tipo: "vence", dias: 14 });
    expect(avisoDaChave(estado("2026-11-30"), "2026-11-15")).toBeNull();
    expect(avisoDaChave(estado("2026-11-15"), "2026-11-15")).toEqual({ tipo: "vence", dias: 0 });
  });

  it("depois do vencimento, diz que venceu", () => {
    expect(avisoDaChave(estado("2026-11-14"), "2026-11-15")).toEqual({ tipo: "venceu" });
  });

  it("chave recusada pela Garmin ou ausente tem aviso próprio, com ou sem data", () => {
    expect(avisoDaChave(estado("2026-12-30", "invalida"), "2026-11-15")).toEqual({
      tipo: "invalida",
      expirou: false,
    });
    expect(avisoDaChave(estado("2026-11-01", "invalida"), "2026-11-15")).toEqual({
      tipo: "invalida",
      expirou: true,
    });
    expect(avisoDaChave(estado(null, "invalida"), "2026-11-15")).toEqual({
      tipo: "invalida",
      expirou: false,
    });
    expect(avisoDaChave(estado(null, "ausente"), "2026-11-15")).toEqual({ tipo: "ausente" });
  });

  it("sem estado ou antes da primeira verificação, não há o que avisar", () => {
    expect(avisoDaChave(null, "2026-11-15")).toBeNull();
    expect(avisoDaChave(estado(null, "nao_verificada"), "2026-11-15")).toBeNull();
  });

  it("chave aceita mas sem data de vencimento: pede a data; chave mal colada tem aviso próprio", () => {
    expect(avisoDaChave(estado(null), "2026-11-15")).toEqual({ tipo: "sem_data" });
    expect(avisoDaChave(estado(null, "mal_formada"), "2026-11-15")).toEqual({
      tipo: "mal_formada",
    });
  });

  it("propriedade: o aviso aparece exatamente quando faltam 0 a 14 dias", () => {
    fc.assert(
      fc.property(fc.integer({ min: -400, max: 400 }), (dias) => {
        const hoje = "2026-06-01";
        const vence = new Date(Date.parse(`${hoje}T00:00:00Z`) + dias * 86_400_000)
          .toISOString()
          .slice(0, 10);
        expect(diasEntre(hoje, vence)).toBe(dias);
        const aviso = avisoDaChave(estado(vence), hoje);
        expect(aviso !== null && aviso.tipo === "vence").toBe(dias >= 0 && dias <= 14);
        expect(aviso?.tipo === "venceu").toBe(dias < 0);
      }),
    );
  });
});

describe("trava de execução", () => {
  it("só uma execução por vez; a trava expira sozinha e acusa a execução interrompida", async () => {
    const banco = criarBanco(criarD1EmMemoria().d1);
    await lerFotoGarantindoEstado(banco, "2026-11-15T09:59:00.000Z");
    const primeira = await tentarPegarTrava(
      banco,
      "2026-11-15T10:00:00.000Z",
      "2026-11-15T10:05:00.000Z",
    );
    expect(primeira).toEqual({ obtida: true, anteriorInterrompida: false });

    const segunda = await tentarPegarTrava(
      banco,
      "2026-11-15T10:01:00.000Z",
      "2026-11-15T10:06:00.000Z",
    );
    expect(segunda.obtida).toBe(false);

    const depoisDeExpirar = await tentarPegarTrava(
      banco,
      "2026-11-15T10:06:00.000Z",
      "2026-11-15T10:11:00.000Z",
    );
    expect(depoisDeExpirar).toEqual({ obtida: true, anteriorInterrompida: true });

    await registrarFimDaExecucao(
      banco,
      {
        statusDaChave: "ok",
        chaveVenceEm: "2027-01-01",
        erroCodigo: null,
        sucesso: true,
        executou: true,
        pausaAte: null,
        falhasDeLimiteSeguidas: 0,
      },
      "2026-11-15T10:07:00.000Z",
    );
    const foto = await lerFotoDaSincronizacao(banco);
    expect(foto.estado).toMatchObject({
      statusDaChave: "ok",
      travaAte: null,
      ultimoSucessoEm: "2026-11-15T10:07:00.000Z",
      ultimaExecucaoEm: "2026-11-15T10:07:00.000Z",
    });
    expect(foto.perfil).toBeNull();
  });
});

describe("hoje no fuso do atleta", () => {
  it("usa o fuso: de madrugada em UTC ainda é o dia anterior em São Paulo", () => {
    const instante = Date.parse("2026-11-16T01:30:00Z");
    expect(hojeNoFuso(instante, "America/Sao_Paulo")).toBe("2026-11-15");
    expect(hojeNoFuso(instante, "UTC")).toBe("2026-11-16");
    expect(hojeNoFuso(instante, null)).toBe("2026-11-16");
    expect(hojeNoFuso(instante, "Fuso/Que/Nao/Existe")).toBe("2026-11-16");
  });
});
