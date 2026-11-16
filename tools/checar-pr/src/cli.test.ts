import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const CLI = new URL("./cli.ts", import.meta.url).pathname;

function rodar(prBody: string | undefined): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env["PR_BODY"];
  if (prBody !== undefined) env["PR_BODY"] = prBody;
  const r = spawnSync(process.execPath, [CLI], { env, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe("cli.ts: código de saída", () => {
  it("sai com 0 quando a descrição está certa", () => {
    const r = rodar("## Issue\n\nCloses #25\n");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("ok");
  });

  it("sai com 1 e explica quando a descrição está errada", () => {
    const r = rodar("Fecha #25");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('"Closes #25"');
  });

  it("sai com 1 quando PR_BODY não chega ao script", () => {
    const r = rodar(undefined);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("PR_BODY");
  });

  it("aceita corpo vazio como erro, sem travar", () => {
    expect(rodar("").status).toBe(1);
  });
});
