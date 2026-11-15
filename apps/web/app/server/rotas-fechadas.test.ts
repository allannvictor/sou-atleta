import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ehRotaFechada } from "./rotas-fechadas";

describe("ehRotaFechada", () => {
  it.each([
    "/app",
    "/app/",
    "/app/qualquer/coisa",
    "/App",
    "/APP/x",
    "//app",
    "/%61pp",
    "/%41pp",
    "/app.data",
    "/app%2Fx",
    "/%2561pp",
    "/app%",
  ])("%s é fechada", (caminho) => {
    expect(ehRotaFechada(caminho)).toBe(true);
  });

  it.each([
    "/",
    "/privacidade",
    "/privacidade/",
    "/nada",
    "/assets/entry.client-abc.js",
    "/_root.data",
  ])("%s é pública", (caminho) => {
    expect(ehRotaFechada(caminho)).toBe(false);
  });

  it("propriedade: qualquer jeito de escrever /app (maiúsculas, %XX, barras extras) é fechado", () => {
    const letra = (c: string) =>
      fc.oneof(
        fc.constant(c),
        fc.constant(c.toUpperCase()),
        fc.constant(`%${c.charCodeAt(0).toString(16)}`),
        fc.constant(`%${c.charCodeAt(0).toString(16).toUpperCase()}`),
      );
    const variacaoDeApp = fc
      .tuple(letra("a"), letra("p"), letra("p"))
      .map((partes) => partes.join(""));
    const barras = fc.integer({ min: 1, max: 4 }).map((n) => "/".repeat(n));
    const sufixo = fc.oneof(
      fc.constant(""),
      fc.string({ maxLength: 20 }).map((s) => `/${s}`),
      fc.constant(".data"),
    );

    fc.assert(
      fc.property(barras, variacaoDeApp, sufixo, (b, app, resto) => {
        expect(ehRotaFechada(`${b}${app}${resto}`)).toBe(true);
      }),
    );
  });
});
