import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";

import { CABECALHO_JWT, verificarAcesso, type ObterChaves } from "./acesso";

const TIME = "https://sou-atleta-teste.cloudflareaccess.com";
const AUD = "etiqueta-aud-de-teste";
const DONO = "dono@exemplo.test";
const env = { TEAM_DOMAIN: TIME, POLICY_AUD: AUD, EMAILS_PERMITIDOS: DONO };
const comLista = (EMAILS_PERMITIDOS: unknown) => ({ ...env, EMAILS_PERMITIDOS });
/** Passe como `email` ou `type` para omitir o campo do token (`undefined` acionaria o padrão). */
const AUSENTE = Symbol("ausente");
const MENSAGEM_DE_RECUSA = "Acesso negado: esta área é fechada.";

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
    // `email` e `type` aceitam qualquer valor: os testes precisam de token com e-mail ausente,
    // vazio ou de tipo errado. `AUSENTE` omite o campo do token.
    email = DONO,
    type = "app",
  }: {
    iss?: string;
    aud?: string;
    exp?: string | number;
    kid?: string;
    email?: unknown;
    type?: unknown;
  } = {},
): Promise<string> {
  return new SignJWT({
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
    const semExp = await new SignJWT({ email: DONO, type: "app" })
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
    const semIat = await new SignJWT({ email: DONO, type: "app" })
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
      { ...env, TEAM_DOMAIN: "", POLICY_AUD: "" },
      { ...env, POLICY_AUD: "" },
      { ...env, TEAM_DOMAIN: "" },
      { ...env, TEAM_DOMAIN: `${TIME}/` },
      { ...env, TEAM_DOMAIN: "http://sou-atleta-teste.cloudflareaccess.com" },
      { ...env, TEAM_DOMAIN: "https://atacante.exemplo.test" },
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

describe("verificarAcesso: quem entrou (e-mail do JWT contra EMAILS_PERMITIDOS)", () => {
  const recusado403 = { permitido: false, status: 403, mensagem: MENSAGEM_DE_RECUSA };

  it("e-mail da lista entra, com qualquer combinação de maiúsculas no token e na lista", async () => {
    for (const [noToken, naLista] of [
      ["DONO@EXEMPLO.TEST", DONO],
      [DONO, "Dono@Exemplo.TEST"],
      ["Dono@Exemplo.Test", "DONO@exemplo.test"],
    ] as const) {
      const token = await assinar(legitima.privateKey, { email: noToken });
      expect(await verificarAcesso(pedido(token), comLista(naLista), obterChaves)).toEqual({
        permitido: true,
      });
    }
  });

  it("qualquer variação de maiúsculas do e-mail da lista entra (propriedade)", async () => {
    const alvo = "souatletaapp@gmail.com";
    // Cada letra do endereço vira maiúscula ou não, conforme o sorteio.
    const variacoes = fc
      .array(fc.boolean(), { minLength: alvo.length, maxLength: alvo.length })
      .map((maiuscula) =>
        Array.from(alvo, (letra, i) => (maiuscula[i] === true ? letra.toUpperCase() : letra)).join(
          "",
        ),
      );
    await fc.assert(
      fc.asyncProperty(variacoes, variacoes, async (noToken, naLista) => {
        const token = await assinar(legitima.privateKey, { email: noToken });
        const resultado = await verificarAcesso(pedido(token), comLista(naLista), obterChaves);
        expect(resultado).toEqual({ permitido: true });
      }),
      { numRuns: 25 },
    );
  });

  it("a lista cresce só pelo valor da variável: vários e-mails, espaços e vírgulas sobrando", async () => {
    const lista = "  dono@exemplo.test , Amiga@Exemplo.test,, amigo@outro.test ,";
    for (const email of ["dono@exemplo.test", "AMIGA@exemplo.test", "amigo@outro.test"]) {
      const token = await assinar(legitima.privateKey, { email });
      expect(await verificarAcesso(pedido(token), comLista(lista), obterChaves)).toEqual({
        permitido: true,
      });
    }
    const quarto = await assinar(legitima.privateKey, { email: "intruso@exemplo.test" });
    expect(await verificarAcesso(pedido(quarto), comLista(lista), obterChaves)).toEqual(
      recusado403,
    );
  });

  it("e-mail fora da lista recebe 403 com a mesma mensagem de sempre", async () => {
    const token = await assinar(legitima.privateKey, { email: "outra.pessoa@exemplo.test" });
    expect(await verificarAcesso(pedido(token), env, obterChaves)).toEqual(recusado403);
  });

  it("e-mails parecidos com o da lista são recusados (igualdade do endereço inteiro)", async () => {
    const parecidos = [
      "xdono@exemplo.test",
      "dono@exemplo.test.atacante.test",
      "dono@exemplo.testx",
      "dono@sub.exemplo.test",
      "dono+extra@exemplo.test",
      "do.no@exemplo.test",
      "dono@exemplo.test ",
      " dono@exemplo.test",
      "dono@exemplo.test,intruso@exemplo.test",
      "@exemplo.test",
      "exemplo.test",
      // O símbolo Kelvin (U+212A) vira "k" em toLowerCase(); aqui não pode contar como "k".
      "\u212Aim@exemplo.test",
    ];
    for (const email of parecidos) {
      const token = await assinar(legitima.privateKey, { email });
      const lista = email.startsWith("\u212A") ? "kim@exemplo.test" : DONO;
      expect(await verificarAcesso(pedido(token), comLista(lista), obterChaves), email).toEqual(
        recusado403,
      );
    }
  });

  it("JWT sem e-mail, com e-mail vazio ou que não é texto: 403", async () => {
    const invalidos: unknown[] = [AUSENTE, "", " ", 42, null, true, [DONO], { email: DONO }];
    for (const email of invalidos) {
      const token = await assinar(legitima.privateKey, { email });
      expect(await verificarAcesso(pedido(token), env, obterChaves)).toEqual(recusado403);
    }
  });

  it('exige type "app": outro tipo ou ausente: 403', async () => {
    for (const type of [AUSENTE, "", "org", "service", "App", "APP", 1, ["app"], null]) {
      const token = await assinar(legitima.privateKey, { type });
      expect(await verificarAcesso(pedido(token), env, obterChaves)).toEqual(recusado403);
    }
  });

  it("lista ausente, vazia ou malformada: 503 para quem traz JWT, 403 para quem não traz", async () => {
    const token = await assinar(legitima.privateKey);
    const listasRuins: unknown[] = [
      undefined,
      "",
      "   ",
      ",",
      ", ,",
      "*@exemplo.test",
      "@exemplo.test",
      "exemplo.test",
      "semarroba",
      "dono@",
      "dono@exemplo",
      "dono@@exemplo.test",
      "dono@.test",
      "dono@exemplo..test",
      "*",
      "dono@exemplo.test,*@exemplo.test",
      "dono@exemplo.test,semarroba",
      "dono@exemplo.test,@exemplo.test",
      "dôno@exemplo.test",
      "dono@exemplo.test dono2@exemplo.test",
      42,
      null,
      ["dono@exemplo.test"],
    ];
    for (const ruim of listasRuins) {
      const ambiente = { TEAM_DOMAIN: TIME, POLICY_AUD: AUD, EMAILS_PERMITIDOS: ruim };
      expect(
        await verificarAcesso(pedido(token), ambiente, obterChaves),
        JSON.stringify(ruim),
      ).toMatchObject({ permitido: false, status: 503 });
      expect(
        await verificarAcesso(pedido(), ambiente, obterChaves),
        JSON.stringify(ruim),
      ).toMatchObject({ permitido: false, status: 403 });
    }
    const semAChave = { TEAM_DOMAIN: TIME, POLICY_AUD: AUD };
    expect(await verificarAcesso(pedido(token), semAChave, obterChaves)).toMatchObject({
      status: 503,
    });
  });

  it("assinatura inválida com e-mail da lista continua 403 (o e-mail só conta depois da assinatura)", async () => {
    const forjado = await assinar(impostora.privateKey, { email: DONO });
    expect(await verificarAcesso(pedido(forjado), env, obterChaves)).toEqual(recusado403);
  });

  it("a recusa não revela motivo, e-mail nem lista, e é idêntica em todos os casos", async () => {
    const recusas = [
      await verificarAcesso(pedido(), env, obterChaves),
      await verificarAcesso(
        pedido(await assinar(legitima.privateKey, { email: "intruso@exemplo.test" })),
        env,
        obterChaves,
      ),
      await verificarAcesso(
        pedido(await assinar(legitima.privateKey, { email: AUSENTE })),
        env,
        obterChaves,
      ),
      await verificarAcesso(
        pedido(await assinar(legitima.privateKey, { type: "org" })),
        env,
        obterChaves,
      ),
      await verificarAcesso(pedido(await assinar(impostora.privateKey)), env, obterChaves),
    ];
    for (const recusa of recusas) {
      expect(recusa).toEqual(recusado403);
      if (!recusa.permitido) {
        expect(recusa.mensagem).not.toMatch(/e-?mail|lista|EMAILS_PERMITIDOS|exemplo|type|app\b/i);
      }
    }
  });

  it("a mensagem do 503 também não cita e-mail nem o nome da variável", async () => {
    const resultado = await verificarAcesso(
      pedido(await assinar(legitima.privateKey)),
      comLista(""),
      obterChaves,
    );
    expect(resultado).toMatchObject({ permitido: false, status: 503 });
    if (!resultado.permitido) {
      expect(resultado.mensagem).not.toMatch(/e-?mail|lista|EMAILS_PERMITIDOS|exemplo/i);
    }
  });
});
