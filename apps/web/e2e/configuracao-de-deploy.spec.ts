import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { z } from "zod";

/**
 * Confere o build que seria publicado (o mesmo que os outros testes servem): a configuração
 * final do Worker e a lista de arquivos estáticos. O que falha aqui costuma ser silencioso em
 * produção, por isso é testado no resultado do build e não no arquivo de origem.
 */

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

const configuracaoGerada = z.object({
  workers_dev: z.boolean(),
  preview_urls: z.boolean(),
  observability: z.object({ enabled: z.boolean() }),
  assets: z.object({ run_worker_first: z.array(z.string()) }),
});

function arquivosDe(pasta: string, prefixo = ""): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) =>
    entrada.isDirectory()
      ? arquivosDe(`${pasta}${entrada.name}/`, `${prefixo}${entrada.name}/`)
      : [`${prefixo}${entrada.name}`],
  );
}

test.describe("build que vai para a Cloudflare", () => {
  const configuracao = configuracaoGerada.parse(
    JSON.parse(readFileSync(`${DIST}server/wrangler.json`, "utf8")),
  );

  test("nenhum arquivo estático começa com 'app' (em qualquer combinação de maiúsculas)", () => {
    const arquivos = arquivosDe(`${DIST}client/`);
    // Arquivos estáticos são servidos sem passar pela Worker. Se um aparecesse sob /app, ele
    // escaparia da trava de acesso. Os scripts da tela ficam em /assets/, que não começa com app.
    expect(arquivos.length).toBeGreaterThan(0);
    expect(arquivos.filter((caminho) => caminho.toLowerCase().startsWith("app"))).toEqual([]);
  });

  test("a Worker roda antes dos arquivos estáticos em tudo que começa com /app", () => {
    expect(configuracao.assets.run_worker_first).toEqual(
      expect.arrayContaining(["/app*", "/App*", "/APP*"]),
    );
  });

  test("Workers Logs desligados e endereços por versão desligados", () => {
    expect(configuracao.observability.enabled).toBe(false);
    expect(configuracao.preview_urls).toBe(false);
    expect(configuracao.workers_dev).toBe(true);
  });
});

test.describe("arquivos estáticos não escapam da trava", () => {
  test("/assets/ continua público e qualquer /app* continua fechado", async ({ request }) => {
    const pagina = await (await request.get("/")).text();
    const script = /(?:href|src)="(\/assets\/[^"]+\.js)"/.exec(pagina)?.[1];
    expect(script).toBeTruthy();
    expect((await request.get(script ?? "")).status()).toBe(200);
    for (const caminho of ["/app", "/app.html", "/app/index.html", "/App/index.html"]) {
      expect((await request.get(caminho)).status(), caminho).toBe(403);
    }
  });
});
