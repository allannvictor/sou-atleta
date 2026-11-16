/**
 * Regras de camadas (docs/decisoes/0005-arquitetura.md), num arquivo só e SEMPRE como lista de
 * permitidos: a chave da Garmin só existe em `packages/garmin` e `apps/sync`. Qualquer outro
 * pacote ou app, inclusive um que ainda não existe, não pode importar o conector nem citar os
 * segredos `GARMIN_API_KEY` e `GARMIN_CHAVE_VENCE_EM`.
 *
 * Atenção: no ESLint, um bloco posterior SUBSTITUI as opções de `no-restricted-imports` do
 * anterior para os mesmos arquivos. Por isso cada área repete o padrão do conector nos seus
 * próprios padrões. O teste `packages/garmin/src/camadas.test.ts` confere o resultado com
 * caminhos fictícios.
 */

const internal = (name) => `@sou-atleta/${name}`;

const mensagem = (camada, motivo) =>
  `Regra de camadas (docs/decisoes/0005-arquitetura.md): ${camada} ${motivo}`;

const importacoes = (...padroes) => ["error", { patterns: padroes }];

const conector = {
  group: [internal("garmin"), `${internal("garmin")}/*`],
  message: mensagem(
    "o conector da Garmin",
    "só é importado por apps/sync (e vive em packages/garmin): a chave não pode existir em outro lugar.",
  ),
};

const bancoSoNaEntrada = {
  group: [`${internal("db")}/*`],
  message: mensagem(
    "o código de produção",
    "usa só a entrada principal do db; o banco em memória (/teste) é só para testes.",
  ),
};

const projetoTodo = (camada, motivo) => ({
  group: ["@sou-atleta/*"],
  message: mensagem(camada, motivo),
});

const segredos = {
  selector:
    "Identifier[name=/^GARMIN_(API_KEY|CHAVE_VENCE_EM)$/], Literal[value=/^GARMIN_(API_KEY|CHAVE_VENCE_EM)$/]",
  message: mensagem(
    "a chave da Garmin",
    "só existe em packages/garmin e apps/sync; este código nunca a lê nem a cita.",
  ),
};

const codigo = ["**/*.{ts,tsx}"];
const testes = ["**/*.test.{ts,tsx}", "apps/sync/src/teste/**"];
const donosDaChave = ["packages/garmin/**", "apps/sync/**"];

export const camadas = [
  // Padrão para TODO código que não é dono da chave, inclusive pacotes e apps futuros.
  {
    files: codigo,
    ignores: donosDaChave,
    rules: {
      "no-restricted-imports": importacoes(conector),
      "no-restricted-syntax": ["error", segredos],
    },
  },
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": importacoes(
        projetoTodo("o core", "é cálculo puro e não importa nenhum outro pacote do projeto."),
        {
          group: ["node:*"],
          message: mensagem(
            "o core",
            "não usa APIs do Node: ele roda igual no servidor, na web e no app mobile.",
          ),
        },
      ),
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: mensagem("o core", "não faz rede. Quem busca dados é o conector."),
        },
      ],
    },
  },
  {
    files: ["packages/narrative/**/*.ts"],
    rules: {
      "no-restricted-imports": importacoes(conector, {
        group: [internal("db"), `${internal("db")}/*`],
        message: mensagem(
          "o narrative",
          "só recebe fatos já calculados pelo core, nunca dados brutos nem credenciais.",
        ),
      }),
    },
  },
  {
    files: ["packages/db/**/*.ts"],
    rules: {
      "no-restricted-imports": importacoes(
        projetoTodo(
          "o db",
          "só descreve tabelas e estado; não importa nenhum outro pacote do projeto.",
        ),
      ),
    },
  },
  {
    // O conector fala com a Garmin e valida o que volta; não conhece banco, core nem IA.
    files: ["packages/garmin/**/*.ts"],
    rules: {
      "no-restricted-imports": importacoes(
        projetoTodo(
          "o garmin",
          "é só o conector: não importa banco, core nem IA; quem o usa traduz os dados.",
        ),
      ),
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    ignores: testes,
    rules: { "no-restricted-imports": importacoes(conector, bancoSoNaEntrada) },
  },
  {
    // Só o sync usa o conector, e a Garmin falsa e o banco em memória só entram em testes.
    files: ["apps/sync/src/**/*.ts"],
    ignores: testes,
    rules: {
      "no-restricted-imports": importacoes({
        group: [`${internal("garmin")}/*`, `${internal("db")}/*`],
        message:
          "A Garmin falsa e o banco em memória são só para testes (docs/decisoes/0005-arquitetura.md).",
      }),
    },
  },
  {
    // Único arquivo autorizado a escrever em `console`: o registro de eventos da sincronização.
    // Ele só aceita eventos de uma lista fechada (validada com Zod estrito) e há teste que
    // garante que nada fora dela, nem segredo, chega ao console.
    files: ["apps/sync/src/log.ts"],
    rules: { "no-console": "off" },
  },
];
