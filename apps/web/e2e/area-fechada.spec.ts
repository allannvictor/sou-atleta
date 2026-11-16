import { expect, test } from "@playwright/test";

/**
 * A Worker recusa a área fechada por conta própria, sem depender do painel do Cloudflare Access.
 * Estes testes mandam requisições SEM JWT válido do Access e esperam recusa. O caminho feliz
 * (com JWT válido) é coberto nos testes unitários, com chaves geradas na hora.
 */

const CAMINHOS_FECHADOS = [
  "/app",
  "/app/",
  "/app/qualquer/coisa",
  "/app/conta",
  "/App",
  "/APP",
  "/%61pp",
  "/%41pp",
  "/app.data",
  "/app?x=1",
] as const;

// "//app" fica de fora daqui de propósito: o servidor local (Vite + miniflare) lê esse alvo como
// URL relativa ao protocolo (host "app", caminho "/") e a Worker nem o vê. Esse formato é
// coberto nos testes unitários (rotas-fechadas.test.ts e requisicao.test.ts).
const SEM_CONTEUDO = /Você está dentro/;

test.describe("/app sem JWT do Access", () => {
  for (const caminho of CAMINHOS_FECHADOS) {
    test(`${caminho} responde 403 e não mostra o conteúdo`, async ({ request, baseURL }) => {
      const resposta = await request.get(`${baseURL ?? ""}${caminho}`, { maxRedirects: 0 });
      expect([401, 403]).toContain(resposta.status());
      expect(await resposta.text()).not.toMatch(SEM_CONTEUDO);
    });
  }

  test("não aceita só o cookie de outra origem nem um cabeçalho parecido", async ({ request }) => {
    const resposta = await request.get("/app", {
      headers: {
        Cookie: "CF_Authorization=nada",
        "Cf-Access-Authenticated-User-Email": "dono@exemplo.test",
      },
    });
    expect(resposta.status()).toBe(403);
    expect(await resposta.text()).not.toMatch(SEM_CONTEUDO);
  });

  const TOKENS_RUINS = {
    "texto qualquer": "abc",
    "três partes inválidas": "a.b.c",
    "sem assinatura (alg none) com iss e aud corretos":
      "eyJhbGciOiJub25lIn0.eyJpc3MiOiJodHRwczovL3NvdS1hdGxldGEtdGVzdGUuY2xvdWRmbGFyZWFjY2Vzcy5jb20iLCJhdWQiOiJldGlxdWV0YS1hdWQtZGUtdGVzdGUiLCJleHAiOjQxMDI0NDQ4MDB9.",
  } as const;

  for (const [descricao, token] of Object.entries(TOKENS_RUINS)) {
    test(`JWT inválido (${descricao}) responde 403`, async ({ request }) => {
      const resposta = await request.get("/app", { headers: { "Cf-Access-Jwt-Assertion": token } });
      expect(resposta.status()).toBe(403);
      expect(await resposta.text()).not.toMatch(SEM_CONTEUDO);
    });
  }

  test("o navegador anônimo não vê a tela", async ({ page }) => {
    const resposta = await page.goto("/app");
    expect(resposta?.status()).toBe(403);
    await expect(page.getByText("Você está dentro")).toHaveCount(0);
  });

  test("a recusa não vai para cache compartilhado", async ({ request }) => {
    const resposta = await request.get("/app");
    expect(resposta.headers()["cache-control"]).toBe("private, no-store");
  });
});

test.describe("rotas públicas não pedem JWT", () => {
  for (const caminho of ["/", "/privacidade"]) {
    test(`${caminho} responde 200 sem JWT`, async ({ request }) => {
      expect((await request.get(caminho)).status()).toBe(200);
    });
  }
});
