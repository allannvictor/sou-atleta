import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

import { camadas } from "../../../eslint.camadas.js";

/**
 * A chave da Garmin só existe em `packages/garmin` e `apps/sync` (issue #5, decisão 0005). O lint
 * é uma lista de PERMITIDOS: este teste confere o comportamento com caminhos fictícios, inclusive
 * de pacotes que ainda não existem, para uma regra nova nunca apagar outra (no ESLint, um bloco
 * posterior substitui as opções de `no-restricted-imports` do anterior).
 */

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const eslint = new ESLint({ cwd: RAIZ, overrideConfigFile: true, overrideConfig: camadas });

async function regras(caminho: string, codigo: string): Promise<string[]> {
  const [resultado] = await eslint.lintText(codigo, { filePath: `${RAIZ}${caminho}` });
  return (resultado?.messages ?? []).map((m) => m.ruleId ?? `erro:${m.message}`);
}

const IMPORTA_O_CONECTOR =
  'import { criarClienteGarmin } from "@sou-atleta/garmin";\nexport { criarClienteGarmin };\n';
const IMPORTA_SUBCAMINHO =
  'import { criarGarminFalsa } from "@sou-atleta/garmin/teste";\nexport { criarGarminFalsa };\n';
const CITA_O_SEGREDO = 'export const nome = "GARMIN_API_KEY";\n';
const LE_O_SEGREDO = "export const ler = (env) => env.GARMIN_CHAVE_VENCE_EM;\n";
const IMPORTA_BANCO_EM_MEMORIA =
  'import { criarD1EmMemoria } from "@sou-atleta/db/teste";\nexport { criarD1EmMemoria };\n';

const CAMINHOS_FICTICIOS = [
  "apps/qualquer/src/x.ts",
  "apps/admin/app/rota.tsx",
  "packages/novo/src/y.ts",
  "packages/strava/src/index.ts",
  "tools/script.ts",
];

describe("só packages/garmin e apps/sync enxergam a chave", () => {
  it("qualquer pacote ou app, existente ou futuro, NÃO pode importar o conector", async () => {
    for (const caminho of [
      ...CAMINHOS_FICTICIOS,
      "packages/core/src/a.ts",
      "packages/narrative/src/a.ts",
      "packages/db/src/a.ts",
      "apps/web/app/a.ts",
    ]) {
      expect(await regras(caminho, IMPORTA_O_CONECTOR), caminho).toContain("no-restricted-imports");
      expect(await regras(caminho, IMPORTA_SUBCAMINHO), caminho).toContain("no-restricted-imports");
    }
  });

  it("qualquer pacote ou app, existente ou futuro, NÃO pode citar os segredos da Garmin", async () => {
    for (const caminho of [
      ...CAMINHOS_FICTICIOS,
      "packages/core/src/a.ts",
      "packages/narrative/src/a.ts",
      "packages/db/src/a.ts",
      "apps/web/app/a.ts",
    ]) {
      expect(await regras(caminho, CITA_O_SEGREDO), caminho).toContain("no-restricted-syntax");
      expect(await regras(caminho, LE_O_SEGREDO), caminho).toContain("no-restricted-syntax");
    }
  });

  it("apps/sync pode importar o conector; ele e packages/garmin podem citar os segredos", async () => {
    expect(await regras("apps/sync/src/index.ts", IMPORTA_O_CONECTOR)).not.toContain(
      "no-restricted-imports",
    );
    for (const caminho of ["packages/garmin/src/a.ts", "apps/sync/src/index.ts"]) {
      expect(await regras(caminho, CITA_O_SEGREDO), caminho).not.toContain("no-restricted-syntax");
    }
  });

  it("a Garmin falsa e o banco em memória só entram em arquivos de teste da sync", async () => {
    expect(await regras("apps/sync/src/sincronizar.ts", IMPORTA_SUBCAMINHO)).toContain(
      "no-restricted-imports",
    );
    expect(await regras("apps/sync/src/sincronizar.ts", IMPORTA_BANCO_EM_MEMORIA)).toContain(
      "no-restricted-imports",
    );
    for (const caminho of ["apps/sync/src/x.test.ts", "apps/sync/src/teste/ambiente.ts"]) {
      expect(await regras(caminho, IMPORTA_SUBCAMINHO), caminho).not.toContain(
        "no-restricted-imports",
      );
      expect(await regras(caminho, IMPORTA_BANCO_EM_MEMORIA), caminho).not.toContain(
        "no-restricted-imports",
      );
    }
  });
});

describe("as outras regras de camadas continuam valendo (nenhuma apagou a outra)", () => {
  it("o site usa só a entrada principal do db em produção; em teste pode usar o banco em memória", async () => {
    expect(await regras("apps/web/app/a.ts", IMPORTA_BANCO_EM_MEMORIA)).toContain(
      "no-restricted-imports",
    );
    expect(await regras("apps/web/app/a.test.ts", IMPORTA_BANCO_EM_MEMORIA)).not.toContain(
      "no-restricted-imports",
    );
    expect(
      await regras(
        "apps/web/app/a.ts",
        'import { criarBanco } from "@sou-atleta/db";\nexport { criarBanco };\n',
      ),
    ).not.toContain("no-restricted-imports");
    // ...mas nem em teste o site importa o conector.
    expect(await regras("apps/web/app/a.test.ts", IMPORTA_O_CONECTOR)).toContain(
      "no-restricted-imports",
    );
  });

  it("o core não importa nenhum pacote do projeto nem APIs do Node, e não faz rede", async () => {
    expect(
      await regras(
        "packages/core/src/a.ts",
        'import { x } from "@sou-atleta/db";\nexport { x };\n',
      ),
    ).toContain("no-restricted-imports");
    expect(
      await regras(
        "packages/core/src/a.ts",
        'import { readFileSync } from "node:fs";\nexport { readFileSync };\n',
      ),
    ).toContain("no-restricted-imports");
    expect(
      await regras("packages/core/src/a.ts", 'export const f = () => fetch("x");\n'),
    ).toContain("no-restricted-globals");
  });

  it("o narrative não importa db; o db e o garmin não importam outros pacotes do projeto", async () => {
    const IMPORTA_DB = 'import { x } from "@sou-atleta/db";\nexport { x };\n';
    expect(await regras("packages/narrative/src/a.ts", IMPORTA_DB)).toContain(
      "no-restricted-imports",
    );
    expect(
      await regras(
        "packages/db/src/a.ts",
        'import { x } from "@sou-atleta/core";\nexport { x };\n',
      ),
    ).toContain("no-restricted-imports");
    expect(await regras("packages/garmin/src/a.ts", IMPORTA_DB)).toContain("no-restricted-imports");
  });

  it("só apps/sync/src/log.ts pode usar console", async () => {
    const config = new ESLint({
      cwd: RAIZ,
      overrideConfigFile: true,
      overrideConfig: [{ rules: { "no-console": "error" } }, ...camadas],
    });
    const usa = async (caminho: string) =>
      (
        await config.lintText('console.log("x");\n', { filePath: `${RAIZ}${caminho}` })
      )[0]?.messages.map((m) => m.ruleId) ?? [];
    expect(await usa("apps/sync/src/log.ts")).not.toContain("no-console");
    expect(await usa("apps/sync/src/outro.ts")).toContain("no-console");
    expect(await usa("apps/web/app/a.ts")).toContain("no-console");
  });
});
