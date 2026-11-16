import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const WORKFLOW = readFileSync(
  new URL("../../../.github/workflows/checar-pr.yml", import.meta.url),
  "utf8",
);
const linhas = WORKFLOW.split("\n");

describe("checar-pr.yml: invariantes do job", () => {
  it("pula o Dependabot, usando o contexto no if", () => {
    const linhaIf = linhas.find((l) => l.trimStart().startsWith("if:")) ?? "";
    expect(linhaIf).toContain("github.event.pull_request.user.login != 'dependabot[bot]'");
    expect(linhaIf).toContain("github.event.pull_request.base.ref == 'main'");
  });

  it("nunca usa pull_request_target (comentários do YAML não contam)", () => {
    const codigo = linhas.filter((l) => !l.trimStart().startsWith("#")).join("\n");
    expect(codigo).not.toContain("pull_request_target");
  });

  it("não interpola o corpo ou o evento dentro de run:", () => {
    const runs = linhas.filter((l) => l.trimStart().startsWith("run:"));
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) expect(r).not.toContain("${{");
  });

  it("tem concurrency que cancela a execução anterior do mesmo PR", () => {
    expect(WORKFLOW).toContain("group: checar-pr-${{ github.event.pull_request.number }}");
    expect(WORKFLOW).toContain("cancel-in-progress: true");
  });

  it("declara permissões só de leitura", () => {
    expect(WORKFLOW).toMatch(/^permissions:\n {2}contents: read$/m);
  });
});
