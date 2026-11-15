import { expect, test, type APIResponse } from "@playwright/test";

const CABECALHOS_FIXOS = {
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
} as const;

function confereCabecalhos(resposta: APIResponse, { csp }: { csp: RegExp | string }) {
  const cabecalhos = resposta.headers();
  for (const [nome, valor] of Object.entries(CABECALHOS_FIXOS)) {
    expect(cabecalhos[nome], nome).toBe(valor);
  }
  expect(cabecalhos["content-security-policy"]).toMatch(csp);
}

test.describe("cabeçalhos de segurança em todas as respostas", () => {
  const casos = [
    { caminho: "/", status: 200 },
    { caminho: "/privacidade", status: 200 },
    { caminho: "/nao-existe", status: 404 },
    { caminho: "/app", status: 403 },
    { caminho: "/app/qualquer-coisa", status: 403 },
  ];

  for (const { caminho, status } of casos) {
    test(`${caminho} (${String(status)}) leva os quatro cabeçalhos`, async ({ request }) => {
      const resposta = await request.get(caminho);
      expect(resposta.status()).toBe(status);
      confereCabecalhos(resposta, {
        csp: /script-src 'self' 'nonce-[^']+'; .*frame-ancestors 'none'/,
      });
      expect(resposta.headers()["content-security-policy"]).not.toContain("unsafe-inline");
    });
  }

  test("arquivos estáticos (scripts e estilos) também levam os cabeçalhos", async ({ request }) => {
    const pagina = await (await request.get("/")).text();
    const caminhos = [...pagina.matchAll(/(?:href|src)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(
      (m) => m[1] ?? "",
    );
    expect(caminhos.length).toBeGreaterThan(0);
    for (const caminho of caminhos) {
      const resposta = await request.get(caminho);
      expect(resposta.status(), caminho).toBe(200);
      confereCabecalhos(resposta, { csp: "default-src 'none'; frame-ancestors 'none'" });
    }
  });

  test("HSTS não pede preload", async ({ request }) => {
    const resposta = await request.get("/");
    expect(resposta.headers()["strict-transport-security"]).not.toContain("preload");
  });
});

test.describe("CSP com nonce", () => {
  test("todo script da página leva o nonce anunciado no cabeçalho, e o nonce muda a cada resposta", async ({
    request,
  }) => {
    const nonces = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const resposta = await request.get("/privacidade");
      const nonce = /'nonce-([^']+)'/.exec(
        resposta.headers()["content-security-policy"] ?? "",
      )?.[1];
      expect(nonce).toBeTruthy();
      nonces.add(nonce ?? "");

      const html = await resposta.text();
      const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
      expect(scripts.length).toBeGreaterThan(0);
      for (const tag of scripts) {
        expect(tag).toContain(`nonce="${nonce ?? ""}"`);
      }
    }
    expect(nonces.size).toBe(3);
  });

  test("o navegador não bloqueia nada: sem violação de CSP e a página hidrata", async ({
    page,
  }) => {
    const violacoes: string[] = [];
    page.on("console", (mensagem) => {
      if (/content security policy|refused to/i.test(mensagem.text()))
        violacoes.push(mensagem.text());
    });
    page.on("pageerror", (erro) => violacoes.push(erro.message));

    await page.addInitScript(() => {
      const bloqueios: string[] = [];
      Reflect.set(window, "bloqueiosDeCsp", bloqueios);
      document.addEventListener("securitypolicyviolation", (evento) => {
        bloqueios.push(`${evento.violatedDirective} ${evento.blockedURI}`);
      });
    });
    await page.goto("/", { waitUntil: "networkidle" });
    // Navegação no cliente só funciona se os scripts rodaram (hidratação).
    await page.getByRole("main").getByRole("link", { name: "política de privacidade" }).click();
    await expect(page).toHaveURL(/\/privacidade$/);
    const bloqueios = await page.evaluate(
      (): unknown => Reflect.get(window, "bloqueiosDeCsp") as unknown,
    );
    expect(bloqueios).toEqual([]);
    expect(violacoes).toEqual([]);
  });

  test("a página não pode ser embutida em outro site", async ({ request }) => {
    const resposta = await request.get("/");
    expect(resposta.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  });
});
