import { describe, expect, it } from "vitest";

import arquivoDeCabecalhos from "../../public/_headers?raw";

import {
  cabecalhosDeSeguranca,
  comCabecalhosDeSeguranca,
  gerarNonce,
  politicaDeConteudo,
} from "./seguranca";

describe("gerarNonce", () => {
  it("gera valores diferentes a cada chamada, em base64 de 16 bytes", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => gerarNonce()));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    }
  });
});

describe("politicaDeConteudo", () => {
  const politica = politicaDeConteudo("abc123==");
  const diretiva = (nome: string) =>
    politica
      .split("; ")
      .find((parte) => parte.startsWith(`${nome} `))
      ?.slice(nome.length + 1);

  it("só permite script do próprio site ou com o nonce, sem unsafe-inline nem unsafe-eval", () => {
    expect(diretiva("script-src")).toBe("'self' 'nonce-abc123=='");
    expect(politica).not.toContain("unsafe-inline");
    expect(politica).not.toContain("unsafe-eval");
  });

  it("proíbe ser embutido em outro site, plugins e <base>", () => {
    expect(diretiva("frame-ancestors")).toBe("'none'");
    expect(diretiva("object-src")).toBe("'none'");
    expect(diretiva("base-uri")).toBe("'none'");
  });

  it("não deixa carregar nada de outro domínio", () => {
    expect(politica).not.toMatch(/https?:/);
    expect(politica).not.toContain("*");
  });
});

describe("cabecalhosDeSeguranca", () => {
  it("traz os quatro cabeçalhos da especificação", () => {
    const cabecalhos = cabecalhosDeSeguranca({ nonce: "n", comCsp: true });
    expect(cabecalhos.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(cabecalhos.get("Strict-Transport-Security")).toBe("max-age=31536000");
    expect(cabecalhos.get("X-Content-Type-Options")).toBe("nosniff");
    expect(cabecalhos.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("HSTS tem exatamente um ano e não pede preload", () => {
    const hsts = cabecalhosDeSeguranca({ nonce: "n", comCsp: true }).get(
      "Strict-Transport-Security",
    );
    expect(hsts).not.toContain("preload");
    expect(hsts).not.toContain("includeSubDomains");
  });

  it("sem CSP só no modo de desenvolvimento", () => {
    const cabecalhos = cabecalhosDeSeguranca({ nonce: "n", comCsp: false });
    expect(cabecalhos.has("Content-Security-Policy")).toBe(false);
    expect(cabecalhos.has("X-Content-Type-Options")).toBe(true);
  });

  it("o _headers dos arquivos estáticos diz o mesmo que a Worker", () => {
    const arquivo = arquivoDeCabecalhos;
    const esperado = cabecalhosDeSeguranca({ nonce: "n", comCsp: false });
    for (const nome of ["Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy"]) {
      expect(arquivo).toContain(`${nome}: ${esperado.get(nome) ?? "AUSENTE"}`);
    }
    expect(arquivo).toContain(
      "Content-Security-Policy: default-src 'none'; frame-ancestors 'none'",
    );
  });
});

describe("comCabecalhosDeSeguranca", () => {
  it("funciona com resposta de cabeçalhos imutáveis e preserva status e corpo", async () => {
    const original = Response.redirect("https://exemplo.test/", 302);
    const resposta = comCabecalhosDeSeguranca(original, { nonce: "n", comCsp: true });
    expect(resposta.status).toBe(302);
    expect(resposta.headers.get("Location")).toBe("https://exemplo.test/");
    expect(resposta.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const comCorpo = comCabecalhosDeSeguranca(new Response("oi", { status: 201 }), {
      nonce: "n",
      comCsp: true,
    });
    expect(comCorpo.status).toBe(201);
    expect(await comCorpo.text()).toBe("oi");
  });

  it("sobrescreve cabeçalho de segurança que a rota tenha tentado definir", () => {
    const original = new Response("x", { headers: { "X-Content-Type-Options": "outra-coisa" } });
    const resposta = comCabecalhosDeSeguranca(original, { nonce: "n", comCsp: true });
    expect(resposta.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
