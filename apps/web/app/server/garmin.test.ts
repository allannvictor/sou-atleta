import { criarBanco, lerFotoDaSincronizacao, type FotoDaSincronizacao } from "@sou-atleta/db";
import { criarD1EmMemoria } from "@sou-atleta/db/teste";
import { describe, expect, it } from "vitest";

import { action, loader } from "../routes/app";
import {
  lerPainel,
  montarPainel,
  pedirAtualizacao,
  resultadoDaUrl,
  RESULTADOS_DA_ATUALIZACAO,
} from "./garmin";

const AGORA = new Date("2026-11-15T15:00:00Z");

const estadoBase = {
  statusDaChave: "ok",
  chaveVenceEm: "2027-03-01",
  erroCodigo: null,
  ultimaExecucaoEm: "2026-11-15T14:45:00.000Z",
  ultimoSucessoEm: "2026-11-15T14:45:00.000Z",
  pausaAte: null,
  falhasDeLimiteSeguidas: 0,
  travaAte: null,
} as const;

const foto = (
  extra: Partial<NonNullable<FotoDaSincronizacao["estado"]>> = {},
): FotoDaSincronizacao => ({
  estado: { ...estadoBase, ...extra },
  progresso: [],
  perfil: { fusoHorario: "America/Sao_Paulo", atualizadoEm: "2026-11-15T10:00:00.000Z" },
});

describe("painel da Garmin", () => {
  it("sem banco ligado: diz que ainda não foi configurada e não oferece o botão", () => {
    expect(montarPainel(null, AGORA, true)).toMatchObject({
      situacao: "nao_configurada",
      aviso: null,
      podeAtualizar: false,
    });
  });

  it("aviso de vencimento: aparece a 14 dias e não aparece a 15", () => {
    expect(montarPainel(foto({ chaveVenceEm: "2026-11-29" }), AGORA, true).aviso).toEqual({
      tipo: "vence",
      dias: 14,
    });
    expect(montarPainel(foto({ chaveVenceEm: "2026-11-30" }), AGORA, true).aviso).toBeNull();
  });

  it("chave recusada: aviso de chave inválida, com a data se já passou", () => {
    expect(
      montarPainel(foto({ statusDaChave: "invalida", erroCodigo: "chave_invalida" }), AGORA, true)
        .aviso,
    ).toEqual({ tipo: "invalida", expirou: false });
    expect(
      montarPainel(foto({ statusDaChave: "invalida", chaveVenceEm: "2026-11-01" }), AGORA, true)
        .aviso,
    ).toEqual({ tipo: "invalida", expirou: true });
  });

  it("a data de 'hoje' é a do fuso do atleta, não a de UTC", () => {
    // 01:30 UTC de 16/11 ainda é 15/11 em São Paulo: vencer em 15/11 é "hoje", não "venceu".
    const noite = new Date("2026-11-16T01:30:00Z");
    expect(montarPainel(foto({ chaveVenceEm: "2026-11-15" }), noite, true).aviso).toEqual({
      tipo: "vence",
      dias: 0,
    });
  });

  it("mostra a pausa pedida pela Garmin só enquanto ela vale", () => {
    expect(
      montarPainel(foto({ pausaAte: "2026-11-15T16:00:00.000Z" }), AGORA, true).pausadaAte,
    ).toBe("2026-11-15T16:00:00.000Z");
    expect(
      montarPainel(foto({ pausaAte: "2026-11-15T14:00:00.000Z" }), AGORA, true).pausadaAte,
    ).toBeNull();
  });

  it("importação parada por causa da chave: o quadro sabe disso", () => {
    const progresso = [
      {
        fluxo: "sono" as const,
        inicio: "2026-08-17",
        importadoAte: "2026-10-12",
        historicoCompleto: false,
        verificadoEm: null,
      },
    ];
    const parada = montarPainel({ ...foto({ statusDaChave: "invalida" }), progresso }, AGORA, true);
    expect(parada.importacao).toEqual({ emAndamento: true, ate: "2026-10-12", parada: true });
    const andando = montarPainel({ ...foto(), progresso }, AGORA, true);
    expect(andando.importacao).toEqual({ emAndamento: true, ate: "2026-10-12", parada: false });
  });

  it("expõe a última tentativa e a última atualização separadas", () => {
    const painel = montarPainel(
      foto({
        ultimoSucessoEm: "2026-11-15T10:00:00.000Z",
        ultimaExecucaoEm: "2026-11-15T14:50:00.000Z",
        erroCodigo: "chave_invalida",
      }),
      AGORA,
      true,
    );
    expect(painel).toMatchObject({
      ultimaAtualizacaoEm: "2026-11-15T10:00:00.000Z",
      ultimaTentativaEm: "2026-11-15T14:50:00.000Z",
      problema: "chave_invalida",
    });
  });

  it("importação: em andamento até o fluxo mais atrasado; completa quando todos terminaram", () => {
    const base = foto();
    const progresso = (fluxo: "sono" | "hrv", importadoAte: string | null, completo: boolean) => ({
      fluxo,
      inicio: "2020-01-01",
      importadoAte,
      historicoCompleto: completo,
      verificadoEm: null,
    });
    expect(
      montarPainel(
        {
          ...base,
          progresso: [
            progresso("sono", "2024-05-01", false),
            progresso("hrv", "2023-02-01", false),
          ],
        },
        AGORA,
        true,
      ).importacao,
    ).toEqual({ emAndamento: true, ate: "2023-02-01", parada: false });
    expect(
      montarPainel(
        {
          ...base,
          progresso: [progresso("sono", "2026-11-15", true), progresso("hrv", "2026-11-15", true)],
        },
        AGORA,
        true,
      ).importacao,
    ).toEqual({ emAndamento: false, ate: "2026-11-15", parada: false });
  });
});

describe("leitura do banco", () => {
  it("lê o estado gravado pela sincronização e entrega o painel", async () => {
    const memoria = criarD1EmMemoria();
    memoria.executar(
      `INSERT INTO sincronizacao_estado (id, status_da_chave, chave_vence_em, ultimo_sucesso_em, atualizado_em)
       VALUES (1, 'ok', '2026-11-20', '2026-11-15T14:00:00.000Z', '2026-11-15T14:00:00.000Z')`,
    );
    const painel = await lerPainel(
      { banco: memoria.d1, sync: {} as Fetcher, aoFundo: () => undefined },
      AGORA,
    );
    expect(painel).toMatchObject({
      situacao: "pronta",
      aviso: { tipo: "vence", dias: 5 },
      ultimaAtualizacaoEm: "2026-11-15T14:00:00.000Z",
      podeAtualizar: true,
    });
    expect((await lerFotoDaSincronizacao(criarBanco(memoria.d1))).estado?.statusDaChave).toBe("ok");
  });

  it("banco sem migração (tabelas ausentes): 'indisponível', sem lançar nem vazar o erro", async () => {
    const quebrado = {
      batch: () => Promise.reject(new Error("no such table: sincronizacao_estado")),
      prepare: () => {
        throw new Error("no such table: sincronizacao_estado");
      },
    } as unknown as D1Database;
    const painel = await lerPainel(
      { banco: quebrado, sync: undefined, aoFundo: () => undefined },
      AGORA,
    );
    expect(painel.situacao).toBe("indisponivel");
    expect(JSON.stringify(painel)).not.toContain("no such table");
  });

  it("sem D1 ligado, o site abre: nao_configurada", async () => {
    expect(
      (await lerPainel({ banco: undefined, sync: undefined, aoFundo: () => undefined }, AGORA))
        .situacao,
    ).toBe("nao_configurada");
  });
});

describe("pedir a atualização à Worker sync", () => {
  const falsa = (resposta: () => Promise<Response>): Fetcher =>
    ({ fetch: resposta }) as unknown as Fetcher;

  it("repassa só resultados conhecidos", async () => {
    for (const resultado of RESULTADOS_DA_ATUALIZACAO) {
      const sync = falsa(() => Promise.resolve(Response.json({ resultado })));
      expect(await pedirAtualizacao(sync)).toBe(resultado);
    }
  });

  it("resposta estranha, erro de rede ou ligação ausente nunca viram sucesso", async () => {
    expect(
      await pedirAtualizacao(
        falsa(() => Promise.resolve(Response.json({ resultado: "hackeado" }))),
      ),
    ).toBe("erro");
    expect(await pedirAtualizacao(falsa(() => Promise.resolve(new Response("<html>"))))).toBe(
      "erro",
    );
    expect(await pedirAtualizacao(falsa(() => Promise.reject(new Error("caiu"))))).toBe("erro");
    expect(await pedirAtualizacao(undefined)).toBe("nao_configurada");
  });

  it("chama POST /atualizar, sem mandar nenhum cabeçalho nem dado do atleta", async () => {
    let visto: { url: string; init?: RequestInit } | undefined;
    const sync = falsa(() => Promise.resolve(Response.json({ resultado: "iniciada" })));
    (sync as unknown as { fetch: unknown }).fetch = (url: string, init?: RequestInit) => {
      visto = { url, ...(init === undefined ? {} : { init }) };
      return Promise.resolve(Response.json({ resultado: "iniciada" }));
    };
    await pedirAtualizacao(sync);
    expect(visto?.url).toBe("https://sync.interno/atualizar");
    expect(visto?.init).toEqual({ method: "POST" });
  });

  it("na URL só valem os resultados conhecidos", () => {
    expect(resultadoDaUrl("iniciada")).toBe("iniciada");
    expect(resultadoDaUrl("<script>")).toBeNull();
    expect(resultadoDaUrl(null)).toBeNull();
  });
});

describe("rota /app: loader e action", () => {
  const syncFalsa = (chamadas: string[], resultado = "iniciada") =>
    ({
      fetch: (url: string) => {
        chamadas.push(url);
        return Promise.resolve(Response.json({ resultado }));
      },
    }) as unknown as Fetcher;
  const contexto = (sync?: Fetcher, fundo: Promise<unknown>[] = [], banco?: D1Database) =>
    ({
      nonce: "n",
      garmin: { banco, sync, aoFundo: (p: Promise<unknown>) => fundo.push(p) },
    }) as never;
  const pedido = (cabecalhos: Record<string, string> = {}) =>
    new Request("https://sou-atleta.exemplo.test/app", { method: "POST", headers: cabecalhos });
  const argumentos = (request: Request, context: never) =>
    ({ request, context, params: {} }) as never;
  const abrir = (url = "https://sou-atleta.exemplo.test/app") => new Request(url);

  it("o botão só atende pedidos que vêm da própria página (Origin igual ao site)", async () => {
    const sync = syncFalsa([]);
    for (const cabecalhos of [{}, { Origin: "https://site-de-fora.test" }, { Origin: "null" }]) {
      const resposta = await action(argumentos(pedido(cabecalhos), contexto(sync)));
      expect(resposta).toMatchObject({ init: { status: 403 } });
    }
  });

  it("com a origem certa, pede à sync (rota /atualizar) e volta para /app com o resultado", async () => {
    const chamadas: string[] = [];
    const resposta = (await action(
      argumentos(
        pedido({ Origin: "https://sou-atleta.exemplo.test" }),
        contexto(syncFalsa(chamadas, "chave_recusada")),
      ),
    )) as Response;
    expect(chamadas).toEqual(["https://sync.interno/atualizar"]);
    expect(resposta.status).toBe(302);
    expect(resposta.headers.get("Location")).toBe("/app?atualizacao=chave_recusada");
  });

  it("o loader entrega o painel e ignora valor desconhecido em ?atualizacao=", async () => {
    const dados = await loader(
      argumentos(abrir("https://sou-atleta.exemplo.test/app?atualizacao=lixo"), contexto()),
    );
    expect(dados).toMatchObject({
      painel: { situacao: "nao_configurada" },
      resultado: null,
      buscaPedida: false,
    });
  });

  it("abrir a página pede a sincronização em segundo plano, sem esperar o resultado", async () => {
    const memoria = criarD1EmMemoria();
    const chamadas: string[] = [];
    const fundo: Promise<unknown>[] = [];
    let terminou = false;
    const sync = {
      fetch: (url: string) => {
        chamadas.push(url);
        // A resposta da sync demora: a página não pode esperar por ela.
        return new Promise<Response>((resolver) => {
          setTimeout(() => {
            terminou = true;
            resolver(Response.json({ resultado: "iniciada" }));
          }, 50);
        });
      },
    } as unknown as Fetcher;
    const dados = await loader(argumentos(abrir(), contexto(sync, fundo, memoria.d1)));
    expect(dados).toMatchObject({ buscaPedida: true });
    expect(chamadas).toEqual(["https://sync.interno/ao-abrir"]);
    expect(terminou).toBe(false); // a página já saiu
    expect(fundo).toHaveLength(1);
    await Promise.all(fundo);
    expect(terminou).toBe(true);
  });

  it("não pede de novo se a última tentativa foi há menos de 10 minutos, nem se a Garmin pediu espera", async () => {
    const chamadas: string[] = [];
    const recente = criarD1EmMemoria();
    recente.executar(
      `INSERT INTO sincronizacao_estado (id, status_da_chave, ultima_execucao_em, atualizado_em)
       VALUES (1, 'ok', '${new Date(Date.now() - 5 * 60_000).toISOString()}', '2026-11-15T00:00:00.000Z')`,
    );
    const dados = await loader(argumentos(abrir(), contexto(syncFalsa(chamadas), [], recente.d1)));
    expect(dados).toMatchObject({ buscaPedida: false });
    expect(chamadas).toEqual([]);

    const pausada = criarD1EmMemoria();
    pausada.executar(
      `INSERT INTO sincronizacao_estado (id, status_da_chave, erro_codigo, pausa_ate, ultima_execucao_em, atualizado_em)
       VALUES (1, 'ok', 'limite_garmin', '${new Date(Date.now() + 3_600_000).toISOString()}', '2026-11-14T00:00:00.000Z', '2026-11-14T00:00:00.000Z')`,
    );
    const outra = await loader(argumentos(abrir(), contexto(syncFalsa(chamadas), [], pausada.d1)));
    expect(outra).toMatchObject({ buscaPedida: false });
    expect(chamadas).toEqual([]);
  });

  it("falha ao pedir a sincronização nunca derruba a página", async () => {
    const memoria = criarD1EmMemoria();
    const fundo: Promise<unknown>[] = [];
    const sync = { fetch: () => Promise.reject(new Error("caiu")) } as unknown as Fetcher;
    await expect(
      loader(argumentos(abrir(), contexto(sync, fundo, memoria.d1))),
    ).resolves.toMatchObject({ buscaPedida: true });
    await expect(Promise.all(fundo)).resolves.toBeDefined();
  });

  it("sem a ligação com a sync, não pede nada", async () => {
    const memoria = criarD1EmMemoria();
    const dados = await loader(argumentos(abrir(), contexto(undefined, [], memoria.d1)));
    expect(dados).toMatchObject({ buscaPedida: false });
  });
});
