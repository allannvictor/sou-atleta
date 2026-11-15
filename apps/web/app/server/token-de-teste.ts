import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";

import type { ObterChaves } from "./acesso";

/**
 * Montagem de JWT do Access para os testes. Fica num lugar só para os testes de `acesso`,
 * `requisicao` e `emails-no-wrangler` não terem cópias que divergem quando o formato do token
 * mudar. Nenhum código de produção importa este arquivo.
 */

export const TIME_DE_TESTE = "https://sou-atleta-teste.cloudflareaccess.com";
export const AUD_DE_TESTE = "etiqueta-aud-de-teste";
export const KID_DE_TESTE = "chave-1";

/** Passe como valor de um campo do token para omiti-lo (`undefined` acionaria o padrão). */
export const AUSENTE = Symbol("ausente");

export type ParDeChaves = Awaited<ReturnType<typeof generateKeyPair>>;

export interface ChavesDeTeste {
  /** Par cuja chave pública o Access "publica" (`obterChaves`). */
  readonly legitima: ParDeChaves;
  /** Par que ninguém publicou: serve para forjar assinatura. */
  readonly impostora: ParDeChaves;
  readonly obterChaves: ObterChaves;
}

export async function criarChavesDeTeste(): Promise<ChavesDeTeste> {
  const legitima = await generateKeyPair("RS256");
  const impostora = await generateKeyPair("RS256");
  const jwk: JWK = {
    ...(await exportJWK(legitima.publicKey)),
    kid: KID_DE_TESTE,
    alg: "RS256",
    use: "sig",
  };
  const conjunto = createLocalJWKSet({ keys: [jwk] });
  return { legitima, impostora, obterChaves: () => conjunto };
}

export interface OpcoesDoToken {
  readonly iss?: string;
  readonly aud?: string;
  readonly exp?: string | number;
  readonly kid?: string;
  /** Qualquer valor: os testes precisam de e-mail ausente, vazio ou de tipo errado. */
  readonly email?: unknown;
  /** Qualquer valor, como `email`. */
  readonly type?: unknown;
  /** Campos extras no corpo do token, por exemplo os de um token de serviço. */
  readonly extras?: Readonly<Record<string, unknown>>;
}

/** Assina um JWT no formato do Access para pessoa: `email` e `type` "app". */
export async function assinar(
  chave: ParDeChaves["privateKey"],
  {
    iss = TIME_DE_TESTE,
    aud = AUD_DE_TESTE,
    exp = "5m",
    kid = KID_DE_TESTE,
    email = "dono@exemplo.test",
    type = "app",
    extras = {},
  }: OpcoesDoToken = {},
): Promise<string> {
  return new SignJWT({
    ...extras,
    ...(email === AUSENTE ? {} : { email }),
    ...(type === AUSENTE ? {} : { type }),
  })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(chave);
}
