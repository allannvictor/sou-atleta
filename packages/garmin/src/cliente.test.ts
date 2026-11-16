import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { GarminKey } from "./chave.js";
import { criarCacheDeToken, criarClienteGarmin, validarJanela } from "./cliente.js";
import {
  AcessoNegadoError,
  ChaveInvalidaError,
  GarminIndisponivelError,
  LimiteExcedidoError,
  PedidoRecusadoError,
  RedeGarminError,
  RespostaInesperadaError,
  TokenRecusadoError,
} from "./erros.js";
import {
  ATIVIDADES_POR_PAGINA,
  ESPERA_MAXIMA_APOS_429_S,
  ESPERA_PADRAO_APOS_429_S,
  FRACAO_MAXIMA_DA_JANELA_OFICIAL,
  JANELA_DIAS,
  JANELA_MAXIMA_OFICIAL_DIAS,
  MENOR_JANELA_OFICIAL_CONHECIDA_DIAS,
  PAUSA_ENTRE_REQUISICOES_MS,
  TAMANHO_MAXIMO_DA_RESPOSTA,
} from "./limites.js";
import {
  atividadeBruta,
  criarGarminFalsa,
  diasSeguidos,
  VALORES_PROIBIDOS,
} from "./teste/garmin-falsa.js";
import type { Fluxo } from "./tipos.js";

const CHAVE = "chave-de-mentira-0123456789abcdef";
const HORA = 3_600_000;

/** Relógio falso: `dormir` avança o tempo, como esperar de verdade, só que instantâneo. */
function montar(
  opcoes: { atividades?: ReturnType<typeof atividadeBruta>[]; dias?: string[] } = {},
) {
  let agora = Date.parse("2026-11-15T12:00:00Z");
  const pausas: number[] = [];
  const garmin = criarGarminFalsa({
    chave: CHAVE,
    agora: () => agora,
    dados: { atividades: opcoes.atividades ?? [], diasDeSaude: opcoes.dias ?? [] },
  });
  const cliente = criarClienteGarmin({
    chave: GarminKey.de(CHAVE),
    fetch: garmin.fetch,
    agora: () => agora,
    dormir: (ms) => {
      pausas.push(ms);
      agora += ms;
      return Promise.resolve();
    },
  });
  return {
    garmin,
    cliente,
    pausas,
    avancar: (ms: number) => {
      agora += ms;
    },
    agora: () => agora,
  };
}

const JANELA = { de: "2026-11-01", ate: "2026-11-05" };

describe("troca da chave por token", () => {
  it("manda a chave só no cabeçalho da troca e o token (não a chave) nas consultas", async () => {
    const { garmin, cliente } = montar({ dias: ["2026-11-02"] });
    await cliente.sono(JANELA);
    const [troca, consulta] = garmin.requisicoes;
    expect(troca).toMatchObject({
      metodo: "POST",
      caminho: "/personalapitoken-service/personal-api/personal-api-key/token",
      autorizacao: `ApiKey ${CHAVE}`,
    });
    expect(consulta?.autorizacao).toBe("Bearer token-falso-1");
    expect(JSON.stringify(consulta)).not.toContain(CHAVE);
  });

  it("reaproveita o token enquanto ele vale e pede outro depois de 24 h (relógio simulado)", async () => {
    const { garmin, cliente, avancar } = montar({ dias: ["2026-11-02"] });
    await cliente.sono(JANELA);
    await cliente.sono(JANELA);
    expect(garmin.tokensEmitidos()).toHaveLength(1);

    avancar(24 * HORA);
    const sono = await cliente.sono(JANELA);
    expect(sono).toHaveLength(1);
    expect(garmin.tokensEmitidos()).toHaveLength(2);
    expect(garmin.requisicoes.at(-1)?.autorizacao).toBe("Bearer token-falso-2");
  });

  it("se a Garmin recusar um token que ainda parecia válido, pede outro uma vez e continua", async () => {
    const { garmin, cliente } = montar({ dias: ["2026-11-02"] });
    await cliente.sono(JANELA);
    garmin.forcarFalha("dailySleepSummariesByDate", { status: 401, vezes: 1 });
    await expect(cliente.sono(JANELA)).resolves.toHaveLength(1);
    expect(garmin.tokensEmitidos()).toHaveLength(2);
  });

  it("chave expirada ou revogada: ChaveInvalidaError, sem repetir em laço", async () => {
    const { garmin, cliente } = montar();
    garmin.revogarChave();
    await expect(cliente.perfil()).rejects.toBeInstanceOf(ChaveInvalidaError);
    expect(garmin.requisicoes).toHaveLength(1);
  });

  it("token recém-emitido recusado nas consultas NÃO é chave inválida: é erro do conector", async () => {
    const { garmin, cliente } = montar();
    await cliente.perfil();
    garmin.forcarFalha("userprofile", { status: 401 });
    const erro = await cliente.perfil().catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(TokenRecusadoError);
    expect(erro).not.toBeInstanceOf(ChaveInvalidaError);
    expect((erro as TokenRecusadoError).codigo).toBe("token_recusado");
    expect((erro as Error).message).not.toMatch(/expir|revog|gere outra/i);
  });

  it("qualquer 4xx na troca do token (menos 429) é chave recusada", async () => {
    for (const status of [400, 401, 403, 404]) {
      const { garmin, cliente } = montar();
      garmin.forcarFalha("personal-api-key/token", { status });
      await expect(cliente.perfil(), String(status)).rejects.toBeInstanceOf(ChaveInvalidaError);
    }
  });

  it("o cache de token pode ser compartilhado entre clientes do mesmo processo", async () => {
    const cache = criarCacheDeToken();
    const a = montar();
    const cliente1 = criarClienteGarmin({
      chave: GarminKey.de(CHAVE),
      fetch: a.garmin.fetch,
      agora: a.agora,
      dormir: () => Promise.resolve(),
      cacheDeToken: cache,
    });
    const cliente2 = criarClienteGarmin({
      chave: GarminKey.de(CHAVE),
      fetch: a.garmin.fetch,
      agora: a.agora,
      dormir: () => Promise.resolve(),
      cacheDeToken: cache,
    });
    await cliente1.perfil();
    await cliente2.perfil();
    expect(a.garmin.tokensEmitidos()).toHaveLength(1);
  });
});

describe("erros nunca vazam a chave, o token nem dado recebido", () => {
  it("nenhuma mensagem de erro contém a chave, o token ou o corpo da resposta", async () => {
    const { garmin, cliente } = montar({ dias: ["2026-11-02"] });
    await cliente.perfil();
    const casos: [string, number, () => Promise<unknown>][] = [
      ["userprofile", 500, () => cliente.perfil()],
      ["userprofile", 403, () => cliente.perfil()],
      ["userprofile", 418, () => cliente.perfil()],
      ["userprofile", 429, () => cliente.perfil()],
      ["hrv-service", 502, () => cliente.hrv(JANELA)],
    ];
    for (const [trecho, status, chamar] of casos) {
      garmin.forcarFalha(trecho, { status });
      const erro = await chamar().then(
        () => {
          throw new Error("devia falhar");
        },
        (e: unknown) => e as Error,
      );
      garmin.limparFalhas();
      const texto = `${erro.message} ${erro.name} ${JSON.stringify(erro)} ${erro.stack ?? ""}`;
      expect(texto).not.toContain(CHAVE);
      expect(texto).not.toContain("token-falso");
      expect(texto).not.toMatch(/Bearer|ApiKey|Authorization/i);
    }
  });

  it("falha de rede vira RedeGarminError sem a mensagem original", async () => {
    const cliente = criarClienteGarmin({
      chave: GarminKey.de(CHAVE),
      fetch: () => Promise.reject(new Error(`falhou com ApiKey ${CHAVE}`)),
      dormir: () => Promise.resolve(),
    });
    const erro = await cliente.perfil().catch((e: unknown) => e as Error);
    expect(erro).toBeInstanceOf(RedeGarminError);
    expect(JSON.stringify(erro) + (erro as Error).message).not.toContain(CHAVE);
  });

  it("5xx e 403 têm erros próprios", async () => {
    const { garmin, cliente } = montar();
    await cliente.perfil();
    garmin.forcarFalha("userprofile", { status: 503 });
    await expect(cliente.perfil()).rejects.toBeInstanceOf(GarminIndisponivelError);
    garmin.limparFalhas();
    garmin.forcarFalha("userprofile", { status: 403 });
    await expect(cliente.perfil()).rejects.toBeInstanceOf(AcessoNegadoError);
  });
});

describe("limites: janelas e pausa", () => {
  it("as janelas ficam bem abaixo do que a Garmin documenta", () => {
    for (const [fluxo, oficial] of Object.entries(JANELA_MAXIMA_OFICIAL_DIAS)) {
      expect(JANELA_DIAS[fluxo as Fluxo], fluxo).toBeLessThanOrEqual(
        oficial * FRACAO_MAXIMA_DA_JANELA_OFICIAL,
      );
    }
    // Sem valor oficial (atividades e HRV): nunca mais que a menor janela oficial conhecida / 2.
    for (const fluxo of ["atividades", "hrv"] as const) {
      expect(JANELA_DIAS[fluxo]).toBeLessThanOrEqual(MENOR_JANELA_OFICIAL_CONHECIDA_DIAS / 2);
    }
    for (const dias of Object.values(JANELA_DIAS)) expect(dias).toBeGreaterThanOrEqual(1);
    expect(ATIVIDADES_POR_PAGINA).toBeLessThan(99);
  });

  it("o cliente recusa janela maior que a configurada", () => {
    for (const fluxo of ["atividades", "resumo_diario", "sono", "hrv"] as const) {
      const dias = JANELA_DIAS[fluxo];
      expect(() => {
        validarJanela(fluxo, { de: "2026-01-01", ate: `2026-01-${String(dias).padStart(2, "0")}` });
      }).not.toThrow();
      expect(() => {
        validarJanela(fluxo, {
          de: "2026-01-01",
          ate: `2026-01-${String(dias + 1).padStart(2, "0")}`,
        });
      }).toThrow(RangeError);
    }
    expect(() => {
      validarJanela("sono", { de: "2026-01-05", ate: "2026-01-04" });
    }).toThrow(RangeError);
    expect(() => {
      validarJanela("sono", { de: "2026-13-05", ate: "2026-01-04" });
    }).toThrow(RangeError);
  });

  it("propriedade: janela de até N dias passa; de N+1 em diante é recusada", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Fluxo>("atividades", "resumo_diario", "sono", "hrv"),
        fc.integer({ min: 1, max: 60 }),
        (fluxo, tamanho) => {
          const janela = {
            de: "2026-03-01",
            ate: diasSeguidos("2026-03-01", tamanho).at(-1) ?? "",
          };
          const funciona = () => {
            validarJanela(fluxo, janela);
          };
          if (tamanho <= JANELA_DIAS[fluxo]) expect(funciona).not.toThrow();
          else expect(funciona).toThrow(RangeError);
        },
      ),
    );
  });

  it("com o relógio andando, nunca sai uma requisição antes da pausa mínima", async () => {
    const { cliente, garmin } = montar({ dias: ["2026-11-02"] });
    const comTempo: number[] = [];
    let relogio = 0;
    const c = criarClienteGarmin({
      chave: GarminKey.de(CHAVE),
      fetch: (...args) => {
        comTempo.push(relogio);
        return garmin.fetch(...args);
      },
      agora: () => relogio,
      dormir: (ms) => {
        relogio += ms;
        return Promise.resolve();
      },
    });
    for (let i = 0; i < 4; i += 1) await c.sono(JANELA);
    await cliente.perfil();
    for (let i = 1; i < comTempo.length; i += 1) {
      expect((comTempo[i] ?? 0) - (comTempo[i - 1] ?? 0)).toBeGreaterThanOrEqual(
        PAUSA_ENTRE_REQUISICOES_MS,
      );
    }
    expect(comTempo.length).toBe(5);
  });
});

describe("429: esperar em vez de repetir", () => {
  it("para na hora, uma única requisição, com o tempo pedido pela Garmin", async () => {
    const { garmin, cliente } = montar();
    await cliente.perfil();
    const antes = garmin.requisicoes.length;
    garmin.forcarFalha("hrv-service", { status: 429, cabecalhos: { "Retry-After": "120" } });
    const erro = await cliente.hrv(JANELA).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(LimiteExcedidoError);
    expect((erro as LimiteExcedidoError).esperarSegundos).toBe(120);
    expect(garmin.requisicoes.length - antes).toBe(1);
  });

  it("sem Retry-After usa a espera padrão; com valor absurdo, o teto; com data, calcula", async () => {
    const { garmin, cliente, agora } = montar();
    await cliente.perfil();
    const espera = async (cabecalhos: Record<string, string>) => {
      garmin.limparFalhas();
      garmin.forcarFalha("userprofile", { status: 429, cabecalhos });
      const erro = (await cliente.perfil().catch((e: unknown) => e)) as LimiteExcedidoError;
      return erro.esperarSegundos;
    };
    expect(await espera({})).toBe(ESPERA_PADRAO_APOS_429_S);
    expect(await espera({ "Retry-After": "999999999" })).toBe(ESPERA_MAXIMA_APOS_429_S);
    expect(await espera({ "Retry-After": "0" })).toBe(1);
    expect(await espera({ "Retry-After": "lixo" })).toBe(ESPERA_PADRAO_APOS_429_S);
    const daqui5min = new Date(agora() + 300_000).toUTCString();
    expect(await espera({ "Retry-After": daqui5min })).toBeGreaterThanOrEqual(295);
  });

  it("429 na troca do token também vira LimiteExcedidoError", async () => {
    const { garmin, cliente } = montar();
    garmin.forcarFalha("personal-api-key/token", { status: 429 });
    await expect(cliente.perfil()).rejects.toBeInstanceOf(LimiteExcedidoError);
  });
});

describe("validação das respostas (Zod)", () => {
  it("campos de GPS, local, nome e foto da resposta não saem do pacote", async () => {
    const { cliente } = montar({
      atividades: [atividadeBruta(1, "2026-11-02"), atividadeBruta(2, "2026-11-03")],
    });
    const { itens: lista } = await cliente.atividades({ ...JANELA, inicio: 0 });
    expect(lista).toHaveLength(2);
    const saida = JSON.stringify(lista);
    for (const proibido of VALORES_PROIBIDOS) expect(saida).not.toContain(proibido);
    for (const campo of [
      "Latitude",
      "Longitude",
      "locationName",
      "ownerFullName",
      "activityName",
    ]) {
      expect(saida).not.toContain(campo);
    }
    expect(lista[0]).toMatchObject({
      fonte: "garmin",
      id: 1,
      dataLocal: "2026-11-02",
      tipo: "running",
      vo2max: 52,
      efeitoAerobico: 3.4,
      tempoZona3S: 1500,
    });
  });

  it("perfil, zonas, HRV, sono e resumos chegam só com os campos permitidos e com a fonte", async () => {
    const { cliente } = montar({ dias: ["2026-11-02"] });
    const perfil = await cliente.perfil();
    const zonas = await cliente.zonasDeFc();
    const hrv = await cliente.hrv(JANELA);
    const sono = await cliente.sono(JANELA);
    const resumos = await cliente.resumosDiarios(JANELA);
    const tudo = JSON.stringify({ perfil, zonas, hrv, sono, resumos });
    for (const proibido of [
      ...VALORES_PROIBIDOS,
      "Nota pessoal secreta",
      "987654321",
      "123e4567",
    ]) {
      expect(tudo).not.toContain(proibido);
    }
    for (const item of [perfil, ...zonas, ...hrv, ...sono, ...resumos]) {
      expect(item.fonte).toBe("garmin");
    }
    expect(perfil).toMatchObject({
      fusoHorario: "America/Sao_Paulo",
      diasLongos: '["saturday"]',
    });
    expect(zonas[0]).toMatchObject({ fcMaxima: 188, fcRepouso: 50, fcLimiar: 170, zona5Piso: 175 });
    expect(hrv[0]).toMatchObject({ data: "2026-11-02", hrvNoiteMs: 60, hrvSemanaMs: 62 });
    expect(sono[0]).toMatchObject({ sonoS: 27_000, profundoS: 5400 });
    expect(resumos[0]).toMatchObject({ fcRepouso: 52, estresseMedio: 31, bodyBatteryFimDoDia: 25 });
  });

  it("HRV sem dados (204) vira lista vazia, não erro", async () => {
    const { cliente } = montar();
    await expect(cliente.hrv(JANELA)).resolves.toEqual([]);
  });

  it("lista inteira com itens inválidos (formato mudou) é erro claro, sem os valores", async () => {
    const quebradas = [
      atividadeBruta(7, "2026-11-02", { startTimeLocal: undefined }),
      atividadeBruta(8, "2026-11-02", { duration: "muito" }),
      atividadeBruta(9, "2026-11-02", { activityType: { typeKey: 123 } }),
      atividadeBruta(10, "2026-11-02", { averageHR: "alta-secreta" }),
    ];
    const { cliente } = montar({ atividades: quebradas });
    const erro = await cliente.atividades({ ...JANELA, inicio: 0 }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(RespostaInesperadaError);
    const e = erro as RespostaInesperadaError;
    expect(e.campos).toEqual(["itens"]);
    expect(e.message).toContain("formato esperado");
    expect(e.message).not.toContain("alta-secreta");
    expect(e.message).not.toContain("muito");
  });

  it("item inválido isolado é descartado e contado, e a janela segue (só a quantidade vai para fora)", async () => {
    const descartes: [string, number][] = [];
    let agora = 0;
    const garmin = criarGarminFalsa({
      chave: CHAVE,
      agora: () => agora,
      dados: {
        atividades: [
          atividadeBruta(1, "2026-11-02"),
          atividadeBruta(2, "2026-11-02", { duration: "muito-secreto" }),
          atividadeBruta(3, "2026-11-03"),
        ],
        diasDeSaude: ["2026-11-02", "2026-11-03"],
      },
    });
    const cliente = criarClienteGarmin({
      chave: GarminKey.de(CHAVE),
      fetch: garmin.fetch,
      agora: () => agora,
      dormir: (ms) => {
        agora += ms;
        return Promise.resolve();
      },
      aoDescartar: (fluxo, quantidade) => descartes.push([fluxo, quantidade]),
    });
    const { itens: lista } = await cliente.atividades({ ...JANELA, inicio: 0 });
    expect(lista.map((a) => a.id)).toEqual([1, 3]);
    expect(descartes).toEqual([["atividades", 1]]);
    expect(cliente.itensDescartados()).toBe(1);
    expect(JSON.stringify(descartes)).not.toContain("muito-secreto");
    // Lista sem nenhum item inválido não chama o aviso.
    descartes.length = 0;
    await cliente.sono(JANELA);
    expect(descartes).toEqual([]);
  });

  it("um único item, inválido, também é descartado (não há como saber se o formato mudou)", async () => {
    const { cliente } = montar({
      atividades: [atividadeBruta(7, "2026-11-02", { duration: "muito" })],
    });
    await expect(cliente.atividades({ ...JANELA, inicio: 0 })).resolves.toMatchObject({
      itens: [],
    });
  });

  it("a página diz quantas atividades a Garmin mandou de verdade, mesmo com itens descartados", async () => {
    const { cliente } = montar({
      atividades: [
        atividadeBruta(1, "2026-11-02"),
        atividadeBruta(2, "2026-11-02", { duration: "muito" }),
        atividadeBruta(3, "2026-11-03"),
      ],
    });
    const pagina = await cliente.atividades({ ...JANELA, inicio: 0 });
    expect(pagina.itens).toHaveLength(2);
    expect(pagina.recebidas).toBe(3);
  });

  it("corpo que não é JSON ou formato de token desconhecido também são erros claros", async () => {
    const semJson = criarClienteGarmin({
      chave: GarminKey.de(CHAVE),
      fetch: () => Promise.resolve(new Response("<html>", { status: 200 })),
      dormir: () => Promise.resolve(),
    });
    await expect(semJson.perfil()).rejects.toBeInstanceOf(RespostaInesperadaError);

    const tokenEstranho = criarClienteGarmin({
      chave: GarminKey.de(CHAVE),
      fetch: () => Promise.resolve(Response.json({ outro: "formato" })),
      dormir: () => Promise.resolve(),
    });
    const erro = await tokenEstranho.perfil().catch((e: unknown) => e as Error);
    expect(erro).toBeInstanceOf(RespostaInesperadaError);
    expect((erro as Error).message).not.toContain('formato"');
  });

  it("origem da FC: cinta (ANT+ ou Bluetooth), pulso (sensor local) ou desconhecido", async () => {
    const atividades = [1, 2, 3, 4, 5].map((id) => atividadeBruta(id, "2026-11-02"));
    const garmin = criarGarminFalsa({
      chave: CHAVE,
      agora: () => 0,
      dados: {
        atividades,
        diasDeSaude: [],
        sensores: {
          1: [{ sourceType: "ANTPLUS", antplusDeviceType: "HEART_RATE", productName: "HRM-Pro" }],
          2: [{ sourceType: "BLUETOOTH_LOW_ENERGY", bleDeviceType: "HEART_RATE" }],
          3: [{ sourceType: "LOCAL", localDeviceType: "WHR" }],
          4: [{ sourceType: "ANTPLUS", antplusDeviceType: "BIKE_POWER" }],
        },
      },
    });
    const cliente = criarClienteGarmin({
      chave: GarminKey.de(CHAVE),
      fetch: garmin.fetch,
      agora: () => 0,
      dormir: () => Promise.resolve(),
    });
    expect(await cliente.origemDeFc(1)).toBe("cinta");
    expect(await cliente.origemDeFc(2)).toBe("cinta");
    expect(await cliente.origemDeFc(3)).toBe("pulso");
    expect(await cliente.origemDeFc(4)).toBe("desconhecido");
    expect(await cliente.origemDeFc(5)).toBe("desconhecido");
    expect(await cliente.origemDeFc(999)).toBe("desconhecido"); // apagada na Garmin (404)
  });
});

const comoTexto = (entrada: RequestInfo | URL): string =>
  typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;

describe("redirecionamentos, tamanho e valores sentinela", () => {
  it("nenhuma requisição segue redirecionamento: 3xx vira erro e nada mais sai", async () => {
    const pedidos: RequestInit[] = [];
    const redireciona = (status: number) =>
      criarClienteGarmin({
        chave: GarminKey.de(CHAVE),
        fetch: (_url, init) => {
          pedidos.push(init ?? {});
          return Promise.resolve(
            new Response(null, { status, headers: { Location: "https://outro-host.test/roubar" } }),
          );
        },
        dormir: () => Promise.resolve(),
      });
    for (const status of [301, 302, 307, 308]) {
      pedidos.length = 0;
      // Redirecionamento já na troca da chave: o cabeçalho com a chave não pode ir adiante.
      await expect(redireciona(status).perfil()).rejects.toBeInstanceOf(PedidoRecusadoError);
      expect(pedidos).toHaveLength(1);
      expect(pedidos[0]?.redirect).toBe("manual");
    }
  });

  it("toda requisição (troca e consultas) pede redirect manual", async () => {
    const { garmin, cliente } = montar({ dias: ["2026-11-02"] });
    const vistos: unknown[] = [];
    const original = garmin.fetch;
    const c = criarClienteGarmin({
      chave: GarminKey.de(CHAVE),
      fetch: (url, init) => {
        vistos.push(init?.redirect);
        return original(url, init);
      },
      dormir: () => Promise.resolve(),
    });
    await c.sono(JANELA);
    await cliente.perfil();
    expect(vistos).toEqual(["manual", "manual"]);
  });

  it("redirecionamento numa consulta (depois do token) também vira erro, sem segunda requisição", async () => {
    const { garmin, cliente } = montar();
    await cliente.perfil();
    const antes = garmin.requisicoes.length;
    garmin.forcarFalha("userprofile", { status: 302, cabecalhos: { Location: "https://x.test/" } });
    await expect(cliente.perfil()).rejects.toBeInstanceOf(PedidoRecusadoError);
    expect(garmin.requisicoes.length - antes).toBe(1);
  });

  it("resposta grande demais é recusada, com o tamanho declarado ou lido", async () => {
    const grande = "x".repeat(TAMANHO_MAXIMO_DA_RESPOSTA + 1);
    const comCorpo = (corpo: () => Response) =>
      criarClienteGarmin({
        chave: GarminKey.de(CHAVE),
        fetch: (url) =>
          Promise.resolve(
            comoTexto(url).includes("token") ? Response.json({ access_token: "t" }) : corpo(),
          ),
        dormir: () => Promise.resolve(),
      });
    const lido = await comCorpo(() => new Response(grande))
      .perfil()
      .catch((e: unknown) => e);
    expect(lido).toBeInstanceOf(RespostaInesperadaError);
    expect((lido as RespostaInesperadaError).campos).toEqual(["tamanho"]);
    const declarado = await comCorpo(
      () =>
        new Response("{}", {
          headers: { "Content-Length": String(TAMANHO_MAXIMO_DA_RESPOSTA + 1) },
        }),
    )
      .perfil()
      .catch((e: unknown) => e);
    expect(declarado).toBeInstanceOf(RespostaInesperadaError);
  });

  it("atividades com 204 (janela sem treino) é lista vazia, não erro", async () => {
    const c = criarClienteGarmin({
      chave: GarminKey.de(CHAVE),
      fetch: (url) =>
        Promise.resolve(
          comoTexto(url).includes("token")
            ? Response.json({ access_token: "t" })
            : new Response(null, { status: 204 }),
        ),
      dormir: () => Promise.resolve(),
    });
    await expect(c.atividades({ ...JANELA, inicio: 0 })).resolves.toMatchObject({
      itens: [],
      recebidas: 0,
    });
  });

  it("valores 'sem dados' da Garmin (-1, 0) não viram medida", async () => {
    const { cliente } = montar({
      atividades: [atividadeBruta(1, "2026-11-02", { averageHR: 0, maxHR: -1 })],
    });
    const {
      itens: [a],
    } = await cliente.atividades({ ...JANELA, inicio: 0 });
    expect(a).toMatchObject({ fcMedia: null, fcMaxima: null });

    const garmin = criarGarminFalsa({
      chave: CHAVE,
      agora: () => 0,
      dados: { atividades: [], diasDeSaude: [] },
    });
    const original = garmin.fetch;
    const c = criarClienteGarmin({
      chave: GarminKey.de(CHAVE),
      fetch: (url, init) =>
        comoTexto(url).includes("dailysummaries")
          ? Promise.resolve(
              Response.json({
                data: [
                  {
                    calendarDate: "2026-11-02",
                    heartRate: { restingValue: 0 },
                    stress: { avgLevel: -1, maxLevel: -2 },
                    bodyBattery: { minValue: -1, maxValue: 101, chargedValue: 50 },
                  },
                ],
              }),
            )
          : original(url, init),
      agora: () => 0,
      dormir: () => Promise.resolve(),
    });
    const [dia] = await c.resumosDiarios(JANELA);
    expect(dia).toMatchObject({
      fcRepouso: null,
      estresseMedio: null,
      estresseMaximo: null,
      bodyBatteryMin: null,
      bodyBatteryMax: null,
      bodyBatteryCarregada: 50,
    });
  });

  it("data e hora com texto a mais no fim, ou listas gigantes, são rejeitadas", async () => {
    const { cliente } = montar({
      atividades: [
        atividadeBruta(1, "2026-11-02", { startTimeLocal: "2026-11-02 07:00:00 e-mail@x.test" }),
      ],
    });
    await expect(cliente.atividades({ ...JANELA, inicio: 0 })).resolves.toMatchObject({
      itens: [],
    });
    const frac = montar({
      atividades: [atividadeBruta(2, "2026-11-02", { startTimeLocal: "2026-11-02T07:00:00.031" })],
    });
    expect((await frac.cliente.atividades({ ...JANELA, inicio: 0 })).itens).toHaveLength(1);
  });
});
