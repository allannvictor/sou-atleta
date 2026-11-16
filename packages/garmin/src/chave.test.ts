import { inspect } from "node:util";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ChaveMalFormadaError, GarminKey, GarminToken, REDACTED } from "./chave.js";

const SEGREDO = "chave-de-mentira-0123456789abcdef";

describe("GarminKey", () => {
  const chave = GarminKey.de(SEGREDO);

  it("imprimir ou serializar por qualquer caminho resulta em [REDACTED]", () => {
    expect(String(chave)).toBe(REDACTED);
    expect(chave[Symbol.toPrimitive]()).toBe(REDACTED);
    expect(chave.toString()).toBe(REDACTED);
    expect(chave.toJSON()).toBe(REDACTED);
    expect(JSON.stringify(chave)).toBe(`"${REDACTED}"`);
    expect(JSON.stringify({ dentro: { chave } })).not.toContain(SEGREDO);
    expect(inspect(chave)).toBe(REDACTED);
    expect(inspect({ a: [chave] }, { depth: 5 })).not.toContain(SEGREDO);
    expect(`${String(chave)}${REDACTED}`).not.toContain(SEGREDO);
    expect([chave].join(",")).toBe(REDACTED);
  });

  it("o valor não fica em nenhuma propriedade visível, nem ao clonar", () => {
    expect(Object.keys(chave)).toEqual([]);
    expect(Object.getOwnPropertyNames(chave)).toEqual([]);
    expect(JSON.stringify(Object.getOwnPropertyDescriptors(chave))).not.toContain(SEGREDO);
    expect(JSON.stringify(structuredClone(chave))).not.toContain(SEGREDO);
    expect(JSON.stringify(Object.assign({}, chave))).not.toContain(SEGREDO);
  });

  it("a única saída do valor é o cabeçalho da troca por token", () => {
    expect(chave.cabecalhoDaTroca()).toBe(`ApiKey ${SEGREDO}`);
  });

  it("tira espaços e quebra de linha das pontas (colagem comum)", () => {
    expect(GarminKey.de(`  ${SEGREDO}\n`).cabecalhoDaTroca()).toBe(`ApiKey ${SEGREDO}`);
  });

  it("recusa o que não é uma chave, sem repetir o valor na mensagem", () => {
    for (const ruim of [undefined, null, 12, "", "   ", `"${SEGREDO}"`, `abc ${SEGREDO}`, "a\nb"]) {
      try {
        GarminKey.de(ruim);
        expect.unreachable();
      } catch (erro) {
        expect(erro).toBeInstanceOf(ChaveMalFormadaError);
        expect((erro as Error).message).not.toContain(SEGREDO);
      }
    }
  });

  it("propriedade: qualquer chave aceita nunca aparece em texto nem JSON", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z0-9_-]{8,64}$/), (valor) => {
        const k = GarminKey.de(valor);
        expect(String(k)).not.toContain(valor);
        expect(JSON.stringify({ k })).not.toContain(valor);
        expect(inspect(k)).not.toContain(valor);
      }),
    );
  });
});

describe("GarminToken", () => {
  it("também se recusa a ser impresso", () => {
    const token = new GarminToken("token-de-mentira-xyz", 123);
    expect(String(token)).toBe(REDACTED);
    expect(JSON.stringify({ token })).not.toContain("token-de-mentira-xyz");
    expect(inspect(token)).toBe(REDACTED);
    expect(token.cabecalho()).toBe("Bearer token-de-mentira-xyz");
  });
});
