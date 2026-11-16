import { describe, expect, it } from "vitest";

import { criarBanco } from "./banco.js";
import { gravarAtividade, gravarPerfil, gravarZonaFc, iniciarProgresso } from "./gravacao.js";
import { lerDadosDoMomentoAtual } from "./leitura.js";
import { criarD1EmMemoria } from "./teste/d1-em-memoria.js";

const AGORA = "2026-11-15T10:00:00.000Z";

describe("leitura do Momento atual", () => {
  it("banco vazio: sem janela, sem atividades", async () => {
    const banco = criarBanco(criarD1EmMemoria().d1);
    expect(await lerDadosDoMomentoAtual(banco)).toEqual({
      fusoHorario: null,
      inicioDasAtividades: null,
      importacaoEmAndamento: false,
      atividades: [],
      zonas: [],
    });
  });

  it("devolve atividades em ordem, tempos por zona, pisos e fuso", async () => {
    const banco = criarBanco(criarD1EmMemoria().d1);
    await banco.batch([
      gravarAtividade(
        banco,
        {
          id: 2,
          dataLocal: "2026-11-02",
          inicioLocal: "2026-11-02 07:00:00",
          inicioGmt: "2026-11-02 10:00:00",
          tipo: "cycling",
          duracaoS: 3600,
          tempoZona2S: 3000,
        },
        AGORA,
      ),
      gravarAtividade(
        banco,
        {
          id: 1,
          dataLocal: "2026-11-01",
          inicioLocal: "2026-11-01 07:00:00",
          inicioGmt: "2026-11-01 10:00:00",
          tipo: "running",
          duracaoS: 1800,
          fcMedia: 150,
        },
        AGORA,
      ),
      gravarZonaFc(
        banco,
        {
          esporte: "DEFAULT",
          zona1Piso: 100,
          zona2Piso: 120,
          zona3Piso: 140,
          zona4Piso: 160,
          zona5Piso: 175,
        },
        AGORA,
      ),
      gravarPerfil(banco, { fusoHorario: "America/Sao_Paulo" }, AGORA),
      ...iniciarProgresso(banco, ["atividades"], "2026-08-17", AGORA),
    ]);
    const dados = await lerDadosDoMomentoAtual(banco);
    expect(dados.atividades.map((a) => a.id)).toEqual([1, 2]);
    expect(dados.atividades[1]?.temposPorZonaS).toEqual([null, 3000, null, null, null]);
    expect(dados.atividades[0]).toMatchObject({ fcOrigem: "desconhecido", fcMedia: 150 });
    expect(dados.zonas).toEqual([{ esporte: "DEFAULT", pisos: [100, 120, 140, 160, 175] }]);
    expect(dados.fusoHorario).toBe("America/Sao_Paulo");
    expect(dados.inicioDasAtividades).toBe("2026-08-17");
    expect(dados.importacaoEmAndamento).toBe(true);
  });
});
