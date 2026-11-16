import { describe, expect, it } from "vitest";

import { verificarDescricao } from "./regra.ts";

const ok = (corpo: string): boolean => verificarDescricao(corpo).ok;

describe("verificarDescricao: exemplos da issue #25", () => {
  it("aceita Closes #5", () => {
    expect(ok("## Issue\n\nCloses #5\n")).toBe(true);
  });

  it("recusa Fecha #5 e manda usar Closes #5", () => {
    const r = verificarDescricao("Fecha #5");
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.includes('"Closes #5"'))).toBe(true);
  });

  it("aceita Refs #4", () => {
    expect(ok("Refs #4")).toBe(true);
  });

  it("recusa descrição sem nenhuma referência", () => {
    const r = verificarDescricao("Ajuste de texto no README.");
    expect(r.ok).toBe(false);
    expect(r.erros[0]).toContain("Sem issue: <motivo>");
  });
});

describe("palavras-chave em inglês", () => {
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
    expect(ok(linha)).toBe(true);
  });

  it("aceita a palavra-chave no meio da frase", () => {
    expect(ok("Este PR closes #5 e prepara o terreno.")).toBe(true);
  });
});

describe("português no início da linha (S2)", () => {
  it.each([
    "Fecha #5",
    "Fecha a #5",
    "Fecha a issue #5",
    "Fecha issue #5",
    "Fechado #5",
    "Fechada #5",
    "Fechei #5",
    "Fechar #5",
    "Resolve a #5",
    "Resolvido #5",
    "Corrige #5",
    "Corrigido #5",
    "- Fecha #5",
    "* Fecha a issue #5",
  ])("recusa %s sem Closes correspondente", (linha) => {
    const r = verificarDescricao(linha);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.includes('"Closes #5"'))).toBe(true);
  });

  it("aceita português quando há Closes para o mesmo número", () => {
    expect(ok("Fecha #5\nCloses #5")).toBe(true);
  });

  it("recusa quando o Closes é de outra issue", () => {
    const r = verificarDescricao("Closes #5\nFecha a #6");
    expect(r.ok).toBe(false);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toContain("#6");
  });
});

describe("frases negativas e prosa (S1)", () => {
  it("não trata 'Isso não fecha #7' como referência em português", () => {
    expect(ok("Isso não fecha #7.\nRefs #1")).toBe(true);
  });

  it("não orienta a trocar por Closes quando a frase é de prosa", () => {
    const r = verificarDescricao("Isso não fecha #7.");
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).not.toContain("Closes #7");
  });

  it("não trata 'Agora corrige #7 em outro PR' como referência", () => {
    expect(ok("Agora corrige #7 em outro PR\nRefs #1")).toBe(true);
  });

  it("não trata 'Corrige o erro #3' como referência", () => {
    expect(ok("Corrige o erro #3\nRefs #4")).toBe(true);
  });
});

describe("S3: uma palavra-chave por issue, código e formatos de referência", () => {
  it("avisa que 'Closes #5, #6' fecha só a #5", () => {
    const r = verificarDescricao("Closes #5, #6");
    expect(r.ok).toBe(false);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toContain("#6");
    expect(r.erros[0]).toContain("só a primeira");
  });

  it("aceita cada issue com a própria palavra-chave", () => {
    expect(ok("Closes #5\nCloses #6\nRefs #7")).toBe(true);
    expect(ok("Closes #5, #6\nCloses #6")).toBe(true);
  });

  it("ignora Closes dentro de código inline", () => {
    expect(verificarDescricao("Use `Closes #5` no corpo.").ok).toBe(false);
    expect(ok("Use `Closes #5` no corpo.\nRefs #5")).toBe(true);
  });

  it("ignora Closes dentro de bloco cercado", () => {
    const corpo = "```\nCloses #5\n```\nRefs #4";
    expect(ok(corpo)).toBe(true);
    expect(verificarDescricao("```\nCloses #5\n```").ok).toBe(false);
  });

  it("ignora Fecha dentro de bloco cercado sem fechar", () => {
    expect(ok("Refs #4\n```\nFecha #5")).toBe(true);
  });

  it("aceita owner/repo#N deste repositório", () => {
    expect(ok("Closes allannvictor/sou-atleta#5")).toBe(true);
  });

  it("aceita URL de issue deste repositório", () => {
    expect(ok("Closes https://github.com/allannvictor/sou-atleta/issues/5")).toBe(true);
  });

  it("não aceita issue de outro repositório", () => {
    expect(ok("Closes outro/projeto#5")).toBe(false);
    expect(ok("Closes https://github.com/outro/projeto/issues/5")).toBe(false);
  });
});

describe('"Sem issue: <motivo>" (decisão do dono, 16/11/2026)', () => {
  it("aceita com motivo", () => {
    expect(ok("Sem issue: passagem de sessão")).toBe(true);
  });

  it("aceita no item de lista", () => {
    expect(ok("- Sem issue: revisão de decisão")).toBe(true);
  });

  it("recusa sem motivo", () => {
    const r = verificarDescricao("Sem issue:");
    expect(r.ok).toBe(false);
    expect(r.erros[0]).toContain("motivo");
  });

  it("recusa com motivo só em espaço", () => {
    expect(ok("Sem issue:    \n")).toBe(false);
  });

  it("não conta quando não está no início da linha", () => {
    expect(ok("Veja: Sem issue: teste")).toBe(false);
  });

  it("não conta quando está só no comentário do modelo", () => {
    expect(ok("<!-- Sem issue: <motivo> -->")).toBe(false);
  });
});

describe("S4: sem erro duplicado para Fecha #N", () => {
  it("Fecha #4 sozinho gera um único erro, o de português", () => {
    const r = verificarDescricao("## Issue\n\nFecha #4\n");
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toContain('"Closes #4"');
    expect(r.erros.some((e) => e.includes("não diz qual issue"))).toBe(false);
  });
});

describe("casos de borda", () => {
  it("recusa descrição vazia", () => {
    expect(ok("")).toBe(false);
  });

  it("recusa Closes sem número", () => {
    expect(ok("Closes #")).toBe(false);
  });

  it("recusa número parcial: Closes #50 não vale para Fecha #5", () => {
    expect(ok("Closes #50\nFecha #5")).toBe(false);
  });

  it("recusa número sem palavra-chave", () => {
    expect(ok("Veja a #5")).toBe(false);
  });

  it("ignora exemplos dentro de comentário HTML do modelo", () => {
    expect(ok('<!-- use "Closes #N" ou "Refs #N" -->\nFecha #')).toBe(false);
  });

  it("aceita várias referências corretas", () => {
    expect(ok("Closes #5\nCloses #6\nRefs #7")).toBe(true);
  });
});

// Corpos reais de PRs já mesclados. Só a linha de issue de cada um, sem e-mail nem outro dado.
describe("PRs reais do repositório", () => {
  it.each([
    { pr: 6, linha: "Fecha #4", esperado: false },
    { pr: 10, linha: "Refs #4", esperado: true },
    { pr: 18, linha: "Fecha #11", esperado: false },
    { pr: 23, linha: "Fecha #21", esperado: false },
    {
      pr: 24,
      linha: "Sem issue: regra de passagem de sessão (`docs/sessoes/README.md`).",
      esperado: true,
    },
  ])("PR #$pr: $esperado", ({ linha, esperado }) => {
    expect(ok(`## Issue\n\n${linha}\n\n## O que muda\n\nTexto qualquer.\n`)).toBe(esperado);
  });
});
