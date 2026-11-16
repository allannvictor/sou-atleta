import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const internal = (name) => `@sou-atleta/${name}`;

const layerMessage = (layer, reason) =>
  `Regra de camadas (docs/decisoes/0005-arquitetura.md): ${layer} ${reason}`;

export default defineConfig(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/node_modules/**",
      // Tipos gerados pelo React Router (`react-router typegen`); não são código nosso.
      "**/.react-router/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-console": "error",
      eqeqeq: ["error", "always"],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@sou-atleta/*"],
              message: layerMessage(
                "o core",
                "é cálculo puro e não importa nenhum outro pacote do projeto.",
              ),
            },
            {
              group: ["node:*"],
              message: layerMessage(
                "o core",
                "não usa APIs do Node: ele roda igual no servidor, na web e no app mobile.",
              ),
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: layerMessage("o core", "não faz rede. Quem busca dados é o conector."),
        },
      ],
    },
  },
  {
    files: ["packages/narrative/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                internal("garmin"),
                internal("db"),
                `${internal("garmin")}/*`,
                `${internal("db")}/*`,
              ],
              message: layerMessage(
                "o narrative",
                "só recebe fatos já calculados pelo core, nunca dados brutos nem credenciais.",
              ),
            },
          ],
        },
      ],
    },
  },
  {
    // O banco só descreve tabelas e estado: não conhece o conector nem o resto do projeto.
    files: ["packages/db/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@sou-atleta/*"],
              message: layerMessage(
                "o db",
                "só descreve tabelas e estado; não importa nenhum outro pacote do projeto.",
              ),
            },
          ],
        },
      ],
    },
  },
  {
    // O conector fala com a Garmin e valida o que volta; não conhece banco, core nem IA.
    files: ["packages/garmin/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@sou-atleta/*"],
              message: layerMessage(
                "o garmin",
                "é só o conector: não importa banco, core nem IA, e quem o usa traduz os dados.",
              ),
            },
          ],
        },
      ],
    },
  },
  {
    // A chave da Garmin só existe em `garmin` e `sync` (issue #5). O site lê o estado no banco e
    // chama o sync por ligação interna, mas nunca importa o conector nem vê a chave.
    files: ["apps/web/**/*.{ts,tsx}", "packages/db/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Identifier[name=/^GARMIN_(API_KEY|CHAVE_VENCE_EM)$/], Literal[value=/^GARMIN_(API_KEY|CHAVE_VENCE_EM)$/]",
          message: layerMessage(
            "a chave da Garmin",
            "só existe em packages/garmin e apps/sync; este código nunca a lê.",
          ),
        },
      ],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [internal("garmin"), `${internal("garmin")}/*`],
              message: layerMessage(
                "o site",
                "não importa o conector da Garmin: a chave só existe em garmin e sync.",
              ),
            },
          ],
        },
      ],
    },
  },
  {
    // Só o sync usa o conector, e a Garmin falsa (`/teste`) só entra em arquivos de teste.
    files: ["apps/sync/src/**/*.ts"],
    ignores: ["**/*.test.ts", "apps/sync/src/teste/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [`${internal("garmin")}/*`, `${internal("db")}/*`],
              message:
                "A Garmin falsa e o banco em memória são só para testes (docs/decisoes/0005-arquitetura.md).",
            },
          ],
        },
      ],
    },
  },
  {
    // Único arquivo autorizado a escrever em `console`: o registro de eventos da sincronização.
    // Ele só aceita eventos de uma lista fechada (validada com Zod estrito) e há teste que
    // garante que nada fora dela, nem segredo, chega ao console.
    files: ["apps/sync/src/log.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
