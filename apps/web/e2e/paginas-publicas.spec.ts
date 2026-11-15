import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGINAS = [
  {
    caminho: "/",
    titulo: /Sou Atleta/,
    h1: /Seus dados de corrida, explicados em linguagem simples/,
  },
  { caminho: "/privacidade", titulo: /Política de privacidade/, h1: /Política de privacidade/ },
] as const;

const TELAS = [
  { nome: "celular", largura: 390, altura: 844 },
  { nome: "desktop", largura: 1280, altura: 800 },
] as const;

const TEMAS = ["light", "dark"] as const;

for (const pagina of PAGINAS) {
  for (const tela of TELAS) {
    for (const tema of TEMAS) {
      test.describe(`${pagina.caminho} no ${tela.nome}, tema ${tema === "light" ? "claro" : "escuro"}`, () => {
        test.use({
          viewport: { width: tela.largura, height: tela.altura },
          colorScheme: tema,
        });

        test("carrega, sem violações de acessibilidade (axe)", async ({ page }) => {
          const resposta = await page.goto(pagina.caminho);
          expect(resposta?.status()).toBe(200);
          await expect(page).toHaveTitle(pagina.titulo);
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(pagina.h1);

          const resultado = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
            .analyze();
          expect(resultado.violations, JSON.stringify(resultado.violations, null, 2)).toEqual([]);
        });

        test("sem rolagem horizontal", async ({ page }) => {
          await page.goto(pagina.caminho);
          const sobra = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(sobra).toBeLessThanOrEqual(0);
        });
      });
    }
  }
}

test.describe("o que o site público não faz", () => {
  for (const pagina of PAGINAS) {
    test(`${pagina.caminho}: sem cookies e sem requisição para outro domínio`, async ({
      page,
      context,
      baseURL,
    }) => {
      const origem = new URL(baseURL ?? "").origin;
      const externas: string[] = [];
      page.on("request", (requisicao) => {
        const url = requisicao.url();
        if (!url.startsWith(origem) && !url.startsWith("data:")) {
          externas.push(url);
        }
      });
      await page.goto(pagina.caminho, { waitUntil: "networkidle" });
      expect(externas).toEqual([]);
      expect(await context.cookies()).toEqual([]);
    });
  }

  test("página abre em pt-BR", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  });
});

test.describe("navegação", () => {
  test("da página inicial para a política e de volta, sem erro no console", async ({ page }) => {
    const erros: string[] = [];
    page.on("console", (mensagem) => {
      if (mensagem.type() === "error") erros.push(mensagem.text());
    });
    page.on("pageerror", (erro) => erros.push(erro.message));

    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: "política de privacidade" }).click();
    await expect(page).toHaveURL(/\/privacidade$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Política de privacidade");
    await page.getByRole("link", { name: "Sou Atleta" }).first().click();
    await expect(page).toHaveURL(/\/$/);
    expect(erros).toEqual([]);
  });

  test("a política mostra o e-mail do projeto e as 10 seções", async ({ page }) => {
    await page.goto("/privacidade");
    await expect(
      page.getByRole("main").getByRole("link", { name: "souatletaapp@gmail.com" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("heading", { level: 2, name: /^\d+\. / }),
    ).toHaveCount(10);
  });

  test("página inexistente responde 404 em pt-BR", async ({ page }) => {
    const resposta = await page.goto("/nao-existe");
    expect(resposta?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Página não encontrada");
  });
});
