import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CABECALHO_JWT, type ObterChaves } from "./acesso";
import { tratarRequisicao } from "./requisicao";

const TIME = "https://sou-atleta-teste.cloudflareaccess.com";
const AUD = "etiqueta-aud-de-teste";
const env = { TEAM_DOMAIN: TIME, POLICY_AUD: AUD };

let tokenValido: string;
let obterChaves: ObterChaves;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k", alg: "RS256" };
  const conjunto = createLocalJWKSet({ keys: [jwk] });
  obterChaves = () => conjunto;
  tokenValido = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "k" })
    .setIssuer(TIME)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
});

const url = (caminho: string) => `https://sou-atleta.exemplo.workers.dev${caminho}`;

function criarRenderizador() {
  return vi.fn((_request: Request, nonce: string) =>
    Promise.resolve(
      new Response(`pagina nonce=${nonce}`, { headers: { "Content-Type": "text/html" } }),
    ),
  );
}

const QUATRO = [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "Referrer-Policy",
];

describe("tratarRequisicao", () => {
  it.each(["/", "/privacidade", "/nao-existe"])(
    "rota pública %s passa sem JWT e leva os 4 cabeçalhos",
    async (caminho) => {
      const renderizar = criarRenderizador();
      const resposta = await tratarRequisicao(new Request(url(caminho)), env, renderizar, {
        obterChaves,
      });
      expect(resposta.status).toBe(200);
      expect(renderizar).toHaveBeenCalledOnce();
      for (const nome of QUATRO) {
        expect(resposta.headers.has(nome), nome).toBe(true);
      }
      expect(resposta.headers.get("Cache-Control")).toBeNull();
    },
  );

  it("entrega ao renderizador o mesmo nonce que anuncia na CSP", async () => {
    const renderizar = criarRenderizador();
    const resposta = await tratarRequisicao(new Request(url("/")), env, renderizar, {
      obterChaves,
    });
    const nonce = renderizar.mock.calls[0]?.[1];
    expect(nonce).toBeTruthy();
    expect(resposta.headers.get("Content-Security-Policy")).toContain(`'nonce-${nonce ?? ""}'`);
  });

  it.each(["/app", "/app/", "/app/tela", "/App", "//app", "/%61pp", "/app.data"])(
    "área fechada %s sem JWT: recusa com 403, nem chega ao React Router e leva os 4 cabeçalhos",
    async (caminho) => {
      const renderizar = criarRenderizador();
      const resposta = await tratarRequisicao(new Request(url(caminho)), env, renderizar, {
        obterChaves,
      });
      expect(resposta.status).toBe(403);
      expect(renderizar).not.toHaveBeenCalled();
      expect(await resposta.text()).not.toContain("pagina");
      expect(resposta.headers.get("Cache-Control")).toBe("private, no-store");
      for (const nome of QUATRO) {
        expect(resposta.headers.has(nome), nome).toBe(true);
      }
    },
  );

  it("área fechada com JWT inválido: recusa", async () => {
    const renderizar = criarRenderizador();
    const requisicao = new Request(url("/app"), { headers: { [CABECALHO_JWT]: "lixo" } });
    const resposta = await tratarRequisicao(requisicao, env, renderizar, { obterChaves });
    expect(resposta.status).toBe(403);
    expect(renderizar).not.toHaveBeenCalled();
  });

  it("área fechada sem configuração do Access: 503 e ninguém entra, nem com JWT", async () => {
    const renderizar = criarRenderizador();
    const requisicao = new Request(url("/app"), { headers: { [CABECALHO_JWT]: tokenValido } });
    const resposta = await tratarRequisicao(
      requisicao,
      { TEAM_DOMAIN: "", POLICY_AUD: "" },
      renderizar,
      { obterChaves },
    );
    expect(resposta.status).toBe(503);
    expect(renderizar).not.toHaveBeenCalled();
  });

  it("área fechada com JWT válido: renderiza, sem cache compartilhado e com os 4 cabeçalhos", async () => {
    const renderizar = criarRenderizador();
    const requisicao = new Request(url("/app"), { headers: { [CABECALHO_JWT]: tokenValido } });
    const resposta = await tratarRequisicao(requisicao, env, renderizar, { obterChaves });
    expect(resposta.status).toBe(200);
    expect(renderizar).toHaveBeenCalledOnce();
    expect(resposta.headers.get("Cache-Control")).toBe("private, no-store");
    for (const nome of QUATRO) {
      expect(resposta.headers.has(nome), nome).toBe(true);
    }
  });

  it("modo de desenvolvimento (comCsp: false) não manda CSP, mas mantém os outros três", async () => {
    const resposta = await tratarRequisicao(new Request(url("/")), env, criarRenderizador(), {
      comCsp: false,
      obterChaves,
    });
    expect(resposta.headers.has("Content-Security-Policy")).toBe(false);
    expect(resposta.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
