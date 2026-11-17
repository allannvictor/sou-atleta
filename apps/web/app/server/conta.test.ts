import { frasesLongas, verificarLinguagem } from "@sou-atleta/narrative";
import { describe, expect, it } from "vitest";

import { MENSAGENS_DO_APAGAR } from "../componentes/conta";
import { action, loader } from "../routes/conta";
import { CAMINHO_DE_SAIDA, confirmacaoValida, pedirApagarTudo, resultadoDaUrl } from "./conta";

const falsa = (resposta: () => Promise<Response>) => ({ fetch: resposta }) as unknown as Fetcher;

describe("pedir à sync que apague", () => {
  it("devolve só resultados conhecidos", async () => {
    for (const resultado of [
      "apagado",
      "chave_presente",
      "sincronizacao_em_andamento",
      "nao_configurada",
      "erro",
    ]) {
      expect(
        await pedirApagarTudo(falsa(() => Promise.resolve(Response.json({ resultado })))),
      ).toBe(resultado);
    }
  });

  it("resposta estranha ou erro de rede nunca viram 'apagado'; sem ligação, 'nao_configurada'", async () => {
    expect(
      await pedirApagarTudo(falsa(() => Promise.resolve(Response.json({ resultado: "hackeado" })))),
    ).toBe("erro");
    expect(await pedirApagarTudo(falsa(() => Promise.resolve(new Response("<html>"))))).toBe(
      "erro",
    );
    expect(await pedirApagarTudo(falsa(() => Promise.resolve(Response.json(null))))).toBe("erro");
    expect(await pedirApagarTudo(falsa(() => Promise.reject(new Error("caiu"))))).toBe("erro");
    expect(await pedirApagarTudo(undefined)).toBe("nao_configurada");
  });

  it("chama POST /apagar-tudo sem mandar nenhum dado", async () => {
    let visto: { url: string; init?: RequestInit } | undefined;
    const sync = {
      fetch: (url: string, init?: RequestInit) => {
        visto = { url, ...(init === undefined ? {} : { init }) };
        return Promise.resolve(Response.json({ resultado: "apagado" }));
      },
    } as unknown as Fetcher;
    await pedirApagarTudo(sync);
    expect(visto?.url).toBe("https://sync.interno/apagar-tudo");
    expect(visto?.init).toEqual({ method: "POST" });
  });

  it("a confirmação é exatamente APAGAR", () => {
    expect(confirmacaoValida("APAGAR")).toBe(true);
    for (const errado of ["apagar", "Apagar", " APAGAR", "APAGAR ", "APAGA", "", null]) {
      expect(confirmacaoValida(errado), String(errado)).toBe(false);
    }
  });

  it("na URL só valem os resultados conhecidos", () => {
    expect(resultadoDaUrl("apagado")).toBe("apagado");
    expect(resultadoDaUrl("confirmacao_errada")).toBe("confirmacao_errada");
    expect(resultadoDaUrl("<script>")).toBeNull();
    expect(resultadoDaUrl(null)).toBeNull();
  });

  it("Sair é o logout do Access no próprio endereço do site", () => {
    expect(CAMINHO_DE_SAIDA).toBe("/cdn-cgi/access/logout");
  });
});

describe("rota /app/conta: loader e action", () => {
  const ORIGEM = "https://sou-atleta.exemplo.test";
  const syncFalsa = (chamadas: string[], resultado = "apagado") =>
    ({
      fetch: (url: string) => {
        chamadas.push(url);
        return Promise.resolve(Response.json({ resultado }));
      },
    }) as unknown as Fetcher;
  const contexto = (sync?: Fetcher) =>
    ({ nonce: "n", garmin: { banco: undefined, sync, aoFundo: () => undefined } }) as never;
  const pedido = (confirmacao: string | null, cabecalhos: Record<string, string> = {}) => {
    const corpo = new FormData();
    if (confirmacao !== null) corpo.set("confirmacao", confirmacao);
    return new Request(`${ORIGEM}/app/conta`, { method: "POST", headers: cabecalhos, body: corpo });
  };
  const argumentos = (request: Request, context: never) =>
    ({ request, context, params: {} }) as never;

  it("só atende pedidos que vêm da própria página, e nada é apagado sem isso", async () => {
    const chamadas: string[] = [];
    for (const cabecalhos of [{}, { Origin: "https://site-de-fora.test" }, { Origin: "null" }]) {
      const resposta = await action(
        argumentos(pedido("APAGAR", cabecalhos), contexto(syncFalsa(chamadas))),
      );
      expect(resposta).toMatchObject({ init: { status: 403 } });
    }
    expect(chamadas).toEqual([]);
  });

  it("sem a palavra de confirmação, não pede nada à sync", async () => {
    const chamadas: string[] = [];
    for (const digitado of [null, "", "apagar", "SIM"]) {
      const resposta = (await action(
        argumentos(pedido(digitado, { Origin: ORIGEM }), contexto(syncFalsa(chamadas))),
      )) as Response;
      expect(resposta.status).toBe(302);
      expect(resposta.headers.get("Location")).toBe("/app/conta?apagar=confirmacao_errada");
    }
    expect(chamadas).toEqual([]);
  });

  it("com origem e palavra certas, pede à sync e volta com o resultado", async () => {
    const chamadas: string[] = [];
    const resposta = (await action(
      argumentos(
        pedido("APAGAR", { Origin: ORIGEM }),
        contexto(syncFalsa(chamadas, "chave_presente")),
      ),
    )) as Response;
    expect(chamadas).toEqual(["https://sync.interno/apagar-tudo"]);
    expect(resposta.headers.get("Location")).toBe("/app/conta?apagar=chave_presente");
  });

  it("o loader ignora valor desconhecido em ?apagar=", () => {
    const dados = loader(argumentos(new Request(`${ORIGEM}/app/conta?apagar=lixo`), contexto()));
    expect(dados).toEqual({ resultado: null });
  });
});

describe("textos da tela Sua conta", () => {
  it("as mensagens passam pela checagem de linguagem e têm frases curtas", () => {
    for (const texto of Object.values(MENSAGENS_DO_APAGAR)) {
      expect(verificarLinguagem(texto)).toEqual([]);
      expect(frasesLongas(texto)).toEqual([]);
    }
  });
});
