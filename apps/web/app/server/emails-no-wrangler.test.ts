import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import wranglerJsonc from "../../wrangler.jsonc?raw";
import { EMAIL_DE_CONTATO } from "../config";
import { CABECALHO_JWT, verificarAcesso } from "./acesso";

/**
 * O repositório é público e o histórico do git é permanente. E-mail de amigo é dado pessoal
 * (LGPD, art. 5): publicá-lo sem consentimento, sem como apagar depois, é um problema. Por isso
 * o `wrangler.jsonc` só pode conter o e-mail do projeto, que já é público. Quando entrar o
 * primeiro amigo, a lista vira secret e este arquivo não muda (issue #11).
 *
 * Lemos o arquivo de origem, comentários inclusos: um e-mail escrito num comentário também
 * seria publicado.
 */

/** Todo trecho com `@` (até espaço, aspas, vírgula ou ponto e vírgula), em minúsculas. */
export function enderecosNoTexto(texto: string): string[] {
  return (texto.match(/[^\s"',;]*@[^\s"',;]*/g) ?? []).map((achado) => achado.toLowerCase());
}

const foraDoProjeto = (texto: string): string[] =>
  enderecosNoTexto(texto).filter((achado) => achado !== EMAIL_DE_CONTATO.toLowerCase());

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

  it("tem EMAILS_PERMITIDOS com o e-mail do projeto (a rota não nasce trancada)", async () => {
    // Usa o valor REAL do arquivo, no topo e no ambiente `teste`, para um erro de digitação
    // aparecer aqui e não como um /app trancado para o dono depois do deploy.
    const valores = [...wranglerJsonc.matchAll(/"EMAILS_PERMITIDOS"\s*:\s*"([^"]*)"/g)].map(
      (achado) => achado[1] ?? "",
    );
    expect(valores).toHaveLength(2);

    const TIME = "https://sou-atleta-teste.cloudflareaccess.com";
    const AUD = "etiqueta-aud-de-teste";
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const conjunto = createLocalJWKSet({
      keys: [{ ...(await exportJWK(publicKey)), kid: "k", alg: "RS256" }],
    });
    // Como o Access pode entregar o endereço: maiúsculas não podem trancar o dono.
    for (const email of [EMAIL_DE_CONTATO, EMAIL_DE_CONTATO.toUpperCase()]) {
      const token = await new SignJWT({ email, type: "app" })
        .setProtectedHeader({ alg: "RS256", kid: "k" })
        .setIssuer(TIME)
        .setAudience(AUD)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
      for (const valor of valores) {
        const pedido = new Request("https://sou-atleta.exemplo.workers.dev/app", {
          headers: { [CABECALHO_JWT]: token },
        });
        const env = { TEAM_DOMAIN: TIME, POLICY_AUD: AUD, EMAILS_PERMITIDOS: valor };
        expect(await verificarAcesso(pedido, env, () => conjunto)).toEqual({ permitido: true });
      }
    }
  });
});
