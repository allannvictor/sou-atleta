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
    ignores: ["**/dist/**", "**/coverage/**", "**/.turbo/**", "**/node_modules/**"],
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
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
