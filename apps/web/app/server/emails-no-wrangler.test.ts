import { beforeAll, describe, expect, it } from "vitest";

import wranglerJsonc from "../../wrangler.jsonc?raw";
import { EMAIL_DE_CONTATO } from "../config";
import { CABECALHO_JWT, verificarAcesso, type ObterChaves } from "./acesso";
import {
  assinar,
  AUD_DE_TESTE,
  criarChavesDeTeste,
  TIME_DE_TESTE,
  type ChavesDeTeste,
} from "./token-de-teste";

/**
 * O repositório é público e o histórico do git é permanente. E-mail de amigo é dado pessoal
 * (LGPD, art. 5): publicá-lo sem consentimento, sem como apagar depois, é um problema. Por isso
 * o `wrangler.jsonc` só pode conter o e-mail do projeto, que já é público. Quando entrar o
 * primeiro amigo, a lista de produção vira secret (docs/decisoes/0005-arquitetura.md) e este
 * arquivo continua passando sem mudança: ele aceita os dois estados válidos da produção.
 *
 * O primeiro teste lê o arquivo de origem, comentários inclusos: um e-mail escrito num
 * comentário também seria publicado.
 */

const NOME_DA_VARIAVEL = "EMAILS_PERMITIDOS";

/**
 * Todo trecho com `@` precedido de algum caractere (até espaço, aspas, vírgula ou ponto e
 * vírgula), em minúsculas. Exigir o que vem antes do `@` evita acusar pacotes com escopo, como
 * `@cloudflare/vite-plugin`, num comentário futuro.
 */
const enderecosNoTexto = (texto: string): string[] =>
  (texto.match(/[^\s"',;@]+@[^\s"',;]*/g) ?? []).map((achado) => achado.toLowerCase());

const foraDoProjeto = (texto: string): string[] =>
  enderecosNoTexto(texto).filter((achado) => achado !== EMAIL_DE_CONTATO.toLowerCase());

/** Comentários de linha inteira (o arquivo não usa comentário no fim da linha). */
const semComentarios = (texto: string): string => texto.replace(/^\s*\/\/.*$/gm, "");

interface ListaNoWrangler {
  /** Valor em `vars` do topo (produção), ou `undefined` se a linha não existe. */
  readonly noTopo: string | undefined;
  /** Valor em `vars` do ambiente `teste`, ou `undefined` se a linha não existe. */
  readonly noTeste: string | undefined;
  /** Nomes em `secrets.required` do topo. */
  readonly secretsObrigatorios: readonly string[];
}

/**
 * Separa o topo do bloco `env` pelo `"env":` com dois espaços de recuo, que é como o Prettier
 * deixa o arquivo. Se o formato mudar, `noTeste` vira `undefined` e o teste falha alto.
 */
function lerListaNoWrangler(texto: string): ListaNoWrangler {
  const [topo = "", ambientes = ""] = semComentarios(texto).split(/^ {2}"env"\s*:/m);
  const valor = (trecho: string) =>
    new RegExp(`"${NOME_DA_VARIAVEL}"\\s*:\\s*"([^"]*)"`).exec(trecho)?.[1];
  const obrigatorios = /"secrets"\s*:\s*\{[^}]*"required"\s*:\s*\[([^\]]*)\]/.exec(topo)?.[1] ?? "";
  return {
    noTopo: valor(topo),
    noTeste: valor(ambientes),
    secretsObrigatorios: [...obrigatorios.matchAll(/"([^"]*)"/g)].map((achado) => achado[1] ?? ""),
  };
}

describe("wrangler.jsonc e e-mails", () => {
  it("só contém o e-mail do projeto; e-mail de terceiros vai em secret", () => {
    expect(
      foraDoProjeto(wranglerJsonc),
      "Só o e-mail do projeto pode estar no wrangler.jsonc (repositório público, histórico " +
        "permanente). Para dar acesso a outra pessoa, use secret: remova EMAILS_PERMITIDOS de " +
        "`vars` e rode `wrangler secret put EMAILS_PERMITIDOS`, com o consentimento da pessoa e " +
        "a política de privacidade atualizada (docs/decisoes/0005-arquitetura.md).",
    ).toEqual([]);
  });

  it("o próprio detector pega e-mail de terceiros, em valor, em lista e em comentário", () => {
    const comLista = '"EMAILS_PERMITIDOS": "souatletaapp@gmail.com,amigo@exemplo.test"';
    const emComentario = "// libera a Ana: ana@exemplo.test\n";
    const curinga = '"EMAILS_PERMITIDOS": "*@gmail.com"';
    expect(foraDoProjeto(comLista)).toEqual(["amigo@exemplo.test"]);
    expect(foraDoProjeto(emComentario)).toEqual(["ana@exemplo.test"]);
    expect(foraDoProjeto(curinga)).toEqual(["*@gmail.com"]);
    expect(foraDoProjeto(`"x": "SouAtletaApp@Gmail.com"`)).toEqual([]);
  });

  it("o detector não acusa pacote com escopo (@cloudflare/...)", () => {
    expect(foraDoProjeto("// usa @cloudflare/vite-plugin e @scope/pacote")).toEqual([]);
  });
});

describe("wrangler.jsonc e a lista EMAILS_PERMITIDOS", () => {
  const TIME = TIME_DE_TESTE;
  const AUD = AUD_DE_TESTE;
  let chaves: ChavesDeTeste;
  let obterChaves: ObterChaves;

  beforeAll(async () => {
    chaves = await criarChavesDeTeste();
    obterChaves = chaves.obterChaves;
  });

  /** O e-mail do projeto, como o Access pode entregá-lo, entra com esta lista? */
  async function donoEntraCom(lista: string): Promise<boolean> {
    // Maiúsculas não podem trancar o dono.
    for (const email of [EMAIL_DE_CONTATO, EMAIL_DE_CONTATO.toUpperCase()]) {
      const token = await assinar(chaves.legitima.privateKey, { email });
      const pedido = new Request("https://sou-atleta.exemplo.workers.dev/app", {
        headers: { [CABECALHO_JWT]: token },
      });
      const env = { TEAM_DOMAIN: TIME, POLICY_AUD: AUD, EMAILS_PERMITIDOS: lista };
      const resultado = await verificarAcesso(pedido, env, obterChaves);
      if (!resultado.permitido) return false;
    }
    return true;
  }

  it("lê os dois estados da produção: lista em vars, ou secret obrigatório sem a linha", () => {
    const comLista = `{
  "vars": { "EMAILS_PERMITIDOS": "a@b.test" },
  "env": { "teste": { "vars": { "EMAILS_PERMITIDOS": "t@b.test" } } }
}`;
    // O que a 0005 manda deixar depois da troca: topo sem a linha e com `secrets.required`.
    const modoSecret = `{
  // "EMAILS_PERMITIDOS": "comentario@b.test" não conta
  "vars": { "TEAM_DOMAIN": "x" },
  "secrets": { "required": ["OUTRO", "EMAILS_PERMITIDOS"] },
  "env": { "teste": { "vars": { "EMAILS_PERMITIDOS": "t@b.test" } } }
}`;
    expect(lerListaNoWrangler(comLista)).toEqual({
      noTopo: "a@b.test",
      noTeste: "t@b.test",
      secretsObrigatorios: [],
    });
    expect(lerListaNoWrangler(modoSecret)).toEqual({
      noTopo: undefined,
      noTeste: "t@b.test",
      secretsObrigatorios: ["OUTRO", NOME_DA_VARIAVEL],
    });
  });

  it("ambiente `teste` tem lista com o e-mail do projeto (os e2e não nascem trancados)", async () => {
    // O ambiente `teste` não herda `vars` nem `secrets` do topo e mantém a própria lista, mesmo
    // depois da troca da produção para secret.
    const { noTeste } = lerListaNoWrangler(wranglerJsonc);
    expect(noTeste, "o ambiente `teste` precisa de EMAILS_PERMITIDOS em `vars`").toBeDefined();
    expect(await donoEntraCom(noTeste ?? "")).toBe(true);
  });

  it("produção: a lista em vars deixa o dono entrar, ou o secret está declarado como obrigatório", async () => {
    // Usa o valor REAL do arquivo para um erro de digitação aparecer aqui e não como um /app
    // trancado para o dono depois do deploy. Em modo secret o valor não está no repositório, e
    // o que se confere é que o deploy falha se o secret faltar (`secrets.required`).
    const { noTopo, secretsObrigatorios } = lerListaNoWrangler(wranglerJsonc);
    const declaradoComoSecret = secretsObrigatorios.includes(NOME_DA_VARIAVEL);
    expect(
      noTopo !== undefined && declaradoComoSecret,
      "EMAILS_PERMITIDOS não pode estar em `vars` e em `secrets.required` ao mesmo tempo: a " +
        "Cloudflare não documenta qual vence (docs/decisoes/0005-arquitetura.md).",
    ).toBe(false);
    if (noTopo === undefined) {
      expect(
        declaradoComoSecret,
        "Sem EMAILS_PERMITIDOS em `vars`, declare-a em `secrets.required` do topo: sem isso o " +
          "deploy não avisa quando o secret falta e a rota /app tranca o dono.",
      ).toBe(true);
    } else {
      expect(await donoEntraCom(noTopo)).toBe(true);
    }
  });
});
