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

test.describe("rodapé no celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("os links têm pelo menos 44px de altura e ficam um embaixo do outro", async ({ page }) => {
    await page.goto("/");
    const links = page.getByRole("contentinfo").getByRole("link");
    await expect(links).toHaveCount(2);
    const caixas = await links.evaluateAll((elementos) =>
      elementos.map((elemento) => {
        const { top, height } = elemento.getBoundingClientRect();
        return { top, height };
      }),
    );
    for (const caixa of caixas) {
      expect(caixa.height).toBeGreaterThanOrEqual(44);
    }
    expect(caixas[1]?.top ?? 0).toBeGreaterThanOrEqual((caixas[0]?.top ?? 0) + 44);
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

  test("a política tem os 10 títulos de seção e a lista de direitos da LGPD", async ({ page }) => {
    await page.goto("/privacidade");
    await expect(page.getByRole("main").getByText("Pelo artigo 18 da LGPD")).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByRole("list", { name: "Direitos do artigo 18 da LGPD" })
        .getByRole("listitem"),
    ).toHaveCount(9);
  });

  test("a política separa sair, desconectar a Garmin e apagar a conta, e traz menores, prazo e inatividade", async ({
    page,
  }) => {
    await page.goto("/privacidade");
    const principal = page.getByRole("main");
    await expect(principal.getByText("Só encerra a sua sessão. Nunca apaga dados.")).toBeVisible();
    await expect(
      principal.getByText(/Interrompe a sincronização e apaga a chave de acesso/),
    ).toBeVisible();
    await expect(principal.getByText(/Apaga todos os seus dados no app, na hora/)).toBeVisible();
    await expect(principal.getByText(/podem levar até 7 dias para sumir/)).toBeVisible();
    await expect(principal.getByText(/Nada disso apaga algo na Garmin/)).toBeVisible();
    await expect(principal.getByText(/até 24 meses sem uso/).first()).toBeVisible();
    await expect(
      principal.getByText("Se soubermos que alguém com menos de 18 anos se cadastrou", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      principal.getByText(
        "Quando você pedir por e-mail, respondemos em até 15 dias, ou antes, se a lei exigir prazo menor.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(principal.getByText(/Também avisamos a Garmin/i)).toHaveCount(0);
    await expect(
      principal.getByText(/Na etapa seguinte \(ainda não ativa\), também avisaremos a Garmin/),
    ).toBeVisible();
    await expect(principal.getByText(/desconectar ou sair/i)).toHaveCount(0);
  });

  test("página inexistente responde 404 em pt-BR", async ({ page }) => {
    const resposta = await page.goto("/nao-existe");
    expect(resposta?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Página não encontrada");
  });
});
