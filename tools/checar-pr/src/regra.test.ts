import { describe, expect, it } from "vitest";

import { verificarDescricao } from "./regra.ts";

describe("verificarDescricao: exemplos da issue #25", () => {
  it("aceita Closes #5", () => {
    expect(verificarDescricao("## Issue\n\nCloses #5\n").ok).toBe(true);
  });

  it("recusa Fecha #5", () => {
    const r = verificarDescricao("Fecha #5");
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.includes('"Closes #5"'))).toBe(true);
  });

  it("aceita Refs #4", () => {
    expect(verificarDescricao("Refs #4").ok).toBe(true);
  });

  it("recusa descrição sem nenhuma referência", () => {
    const r = verificarDescricao("Ajuste de texto no README.");
    expect(r.ok).toBe(false);
    expect(r.erros[0]).toContain("Refs #N");
  });
});

describe("verificarDescricao: palavras-chave em inglês", () => {
  it.each([
    "Close #5",
    "closes #5",
    "CLOSED #5",
    "Fix #5",
    "fixes #5",
    "fixed #5",
    "Resolve #5",
    "resolves #5",
    "resolved #5",
    "Closes: #5",
  ])("aceita %s", (linha) => {
    expect(verificarDescricao(linha).ok).toBe(true);
  });
});

describe("verificarDescricao: português", () => {
  it.each(["Fecha a #5", "fecha #5", "Fechar #5", "Resolve a #5", "Corrige #5", "resolva a #5"])(
    "recusa %s sem Closes correspondente",
    (linha) => {
      expect(verificarDescricao(linha).ok).toBe(false);
    },
  );

  it("aceita português quando há Closes para o mesmo número", () => {
    expect(verificarDescricao("Fecha #5\nCloses #5").ok).toBe(true);
  });

  it("recusa quando o Closes é de outra issue", () => {
    const r = verificarDescricao("Closes #5\nFecha a #6");
    expect(r.ok).toBe(false);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toContain("#6");
  });
});

describe("verificarDescricao: casos de borda", () => {
  it("recusa descrição vazia", () => {
    expect(verificarDescricao("").ok).toBe(false);
  });

  it("recusa Closes sem número", () => {
    expect(verificarDescricao("Closes #").ok).toBe(false);
  });

  it("recusa número parcial: Closes #50 não vale para Fecha #5", () => {
    expect(verificarDescricao("Closes #50\nFecha #5").ok).toBe(false);
  });

  it("recusa número sem palavra-chave", () => {
    expect(verificarDescricao("Veja a #5").ok).toBe(false);
  });

  it("ignora exemplos dentro de comentário HTML do modelo", () => {
    const modelo = '<!-- use "Closes #N" ou "Refs #N" -->\nFecha #';
    expect(verificarDescricao(modelo).ok).toBe(false);
  });

  it("não conta outra palavra antes de #: Corrige o erro #3 não é referência", () => {
    expect(verificarDescricao("Corrige o erro #3\nRefs #4").ok).toBe(true);
  });

  it("aceita várias referências corretas", () => {
    expect(verificarDescricao("Closes #5\nCloses #6\nRefs #7").ok).toBe(true);
  });
});
