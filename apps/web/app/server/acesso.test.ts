import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { CABECALHO_JWT, verificarAcesso, type ObterChaves } from "./acesso";

const TIME = "https://sou-atleta-teste.cloudflareaccess.com";
const AUD = "etiqueta-aud-de-teste";
const env = { TEAM_DOMAIN: TIME, POLICY_AUD: AUD };

type ParDeChaves = Awaited<ReturnType<typeof generateKeyPair>>;

let legitima: ParDeChaves;
let impostora: ParDeChaves;
let obterChaves: ObterChaves;

beforeAll(async () => {
  legitima = await generateKeyPair("RS256");
  impostora = await generateKeyPair("RS256");
  const jwk: JWK = {
    ...(await exportJWK(legitima.publicKey)),
    kid: "chave-1",
    alg: "RS256",
    use: "sig",
  };
  const conjunto = createLocalJWKSet({ keys: [jwk] });
  obterChaves = () => conjunto;
});

async function assinar(
  chave: ParDeChaves["privateKey"],
  {
    iss = TIME,
    aud = AUD,
    exp = "5m",
    kid = "chave-1",
  }: { iss?: string; aud?: string; exp?: string | number; kid?: string } = {},
): Promise<string> {
  return new SignJWT({ email: "dono@exemplo.test" })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(chave);
}

const pedido = (token?: string) =>
  new Request("https://sou-atleta.exemplo.workers.dev/app", {
    headers: token === undefined ? {} : { [CABECALHO_JWT]: token },
  });

describe("verificarAcesso", () => {
  it("deixa entrar com um JWT válido do Access", async () => {
    const resultado = await verificarAcesso(
      pedido(await assinar(legitima.privateKey)),
      env,
      obterChaves,
    );
    expect(resultado).toEqual({ permitido: true });
  });

  it("recusa (403) sem cabeçalho ou com cabeçalho vazio", async () => {
    for (const requisicao of [pedido(), pedido("")]) {
      const resultado = await verificarAcesso(requisicao, env, obterChaves);
      expect(resultado).toMatchObject({ permitido: false, status: 403 });
    }
  });

  it("recusa texto que não é JWT", async () => {
    for (const lixo of ["abc", "a.b.c", "Bearer xyz", "..", "eyJ.eyJ.assinatura"]) {
      const resultado = await verificarAcesso(pedido(lixo), env, obterChaves);
      expect(resultado).toMatchObject({ permitido: false, status: 403 });
    }
  });

  it("recusa JWT assinado com outra chave", async () => {
    const resultado = await verificarAcesso(
      pedido(await assinar(impostora.privateKey)),
      env,
      obterChaves,
    );
    expect(resultado).toMatchObject({ permitido: false, status: 403 });
  });

  it("recusa JWT de outra aplicação (aud diferente)", async () => {
    const token = await assinar(legitima.privateKey, { aud: "outra-aplicacao" });
    expect(await verificarAcesso(pedido(token), env, obterChaves)).toMatchObject({
      permitido: false,
      status: 403,
    });
  });

  it("recusa JWT de outro emissor (iss diferente)", async () => {
    const token = await assinar(legitima.privateKey, {
      iss: "https://outro-time.cloudflareaccess.com",
    });
    expect(await verificarAcesso(pedido(token), env, obterChaves)).toMatchObject({
      permitido: false,
      status: 403,
    });
  });

  it("recusa JWT vencido", async () => {
    const venceu = Math.floor(Date.now() / 1000) - 3600;
    const token = await assinar(legitima.privateKey, { exp: venceu });
    expect(await verificarAcesso(pedido(token), env, obterChaves)).toMatchObject({
      permitido: false,
      status: 403,
    });
  });

  it("recusa JWT válido na assinatura, mas sem validade (sem exp)", async () => {
    // Sem `requiredClaims`, a jose aceitaria este token para sempre.
    const semExp = await new SignJWT({ email: "dono@exemplo.test" })
      .setProtectedHeader({ alg: "RS256", kid: "chave-1" })
      .setIssuer(TIME)
      .setAudience(AUD)
      .setIssuedAt()
      .sign(legitima.privateKey);
    expect(await verificarAcesso(pedido(semExp), env, obterChaves)).toMatchObject({
      permitido: false,
      status: 403,
    });
  });

  it("recusa JWT válido na assinatura, mas sem data de emissão (sem iat)", async () => {
    const semIat = await new SignJWT({ email: "dono@exemplo.test" })
      .setProtectedHeader({ alg: "RS256", kid: "chave-1" })
      .setIssuer(TIME)
      .setAudience(AUD)
      .setExpirationTime("5m")
      .sign(legitima.privateKey);
    expect(await verificarAcesso(pedido(semIat), env, obterChaves)).toMatchObject({
      permitido: false,
      status: 403,
    });
  });

  it("recusa JWT sem assinatura (alg none) mesmo com iss e aud corretos", async () => {
    const parte = (objeto: object) =>
      btoa(JSON.stringify(objeto)).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = `${parte({ alg: "none" })}.${parte({ iss: TIME, aud: AUD, exp })}.`;
    expect(await verificarAcesso(pedido(token), env, obterChaves)).toMatchObject({
      permitido: false,
      status: 403,
    });
  });

  it("recusa algoritmo HS256 (confusão de chave pública como segredo)", async () => {
    const chavePublicaComoSegredo = new TextEncoder().encode(
      JSON.stringify(await exportJWK(legitima.publicKey)),
    );
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", kid: "chave-1" })
      .setIssuer(TIME)
      .setAudience(AUD)
      .setExpirationTime("5m")
      .sign(chavePublicaComoSegredo);
    expect(await verificarAcesso(pedido(token), env, obterChaves)).toMatchObject({
      permitido: false,
      status: 403,
    });
  });

  it("recusa quando as chaves do Access não podem ser obtidas", async () => {
    const semChaves: ObterChaves = () => () => Promise.reject(new Error("sem rede"));
    const token = await assinar(legitima.privateKey);
    expect(await verificarAcesso(pedido(token), env, semChaves)).toMatchObject({
      permitido: false,
      status: 403,
    });
  });

  it("sem configuração (variáveis vazias ou malformadas) recusa todo mundo com 503", async () => {
    const token = await assinar(legitima.privateKey);
    const configuracoesRuins: unknown[] = [
      {},
      undefined,
      { TEAM_DOMAIN: "", POLICY_AUD: "" },
      { TEAM_DOMAIN: TIME, POLICY_AUD: "" },
      { TEAM_DOMAIN: "", POLICY_AUD: AUD },
      { TEAM_DOMAIN: `${TIME}/`, POLICY_AUD: AUD },
      { TEAM_DOMAIN: "http://sou-atleta-teste.cloudflareaccess.com", POLICY_AUD: AUD },
      { TEAM_DOMAIN: "https://atacante.exemplo.test", POLICY_AUD: AUD },
    ];
    for (const ruim of configuracoesRuins) {
      expect(await verificarAcesso(pedido(token), ruim, obterChaves)).toMatchObject({
        permitido: false,
        status: 503,
      });
    }
  });

  it("sem JWT recusa com 403 mesmo se a configuração estiver ruim", async () => {
    // Antes de o Access existir no painel ninguém envia o cabeçalho: o visitante anônimo recebe
    // 403 e não fica sabendo que a configuração da Worker ainda falta.
    expect(await verificarAcesso(pedido(), {}, obterChaves)).toMatchObject({
      permitido: false,
      status: 403,
    });
  });

  it("a mensagem do 503 só aparece para quem já traz um JWT", async () => {
    const semJwt = await verificarAcesso(pedido(), {}, obterChaves);
    const comJwt = await verificarAcesso(pedido("abc.def.ghi"), {}, obterChaves);
    expect(semJwt).toMatchObject({ status: 403 });
    expect(comJwt).toMatchObject({ status: 503 });
  });

  it("a mensagem de recusa não revela o motivo", async () => {
    const resultado = await verificarAcesso(
      pedido(await assinar(impostora.privateKey)),
      env,
      obterChaves,
    );
    expect(resultado.permitido).toBe(false);
    if (!resultado.permitido) {
      expect(resultado.mensagem).not.toMatch(/assinatura|aud|iss|exp|jwt/i);
    }
  });
});
