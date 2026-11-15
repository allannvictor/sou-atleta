import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

/**
 * Validação do JWT do Cloudflare Access dentro da própria Worker.
 *
 * Por quê: o Access barra quem não tem permissão antes de a requisição chegar aqui, mas se a
 * configuração do painel for desfeita ou errada, o acesso fechado não pode depender só dela.
 * Esta checagem é a segunda trava. Fonte:
 * https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
 */

/** Cabeçalho em que o Access entrega o JWT à origem. */
export const CABECALHO_JWT = "Cf-Access-Jwt-Assertion";

/**
 * Domínio do time: é o `iss` do token e a origem de onde vêm as chaves públicas.
 * Só aceitamos o formato real do Access (https, sem barra no fim), para um valor errado na
 * configuração fazer a rota recusar todo mundo em vez de confiar em outro emissor.
 */
const configuracaoDoAcesso = z.object({
  TEAM_DOMAIN: z.string().regex(/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/),
  POLICY_AUD: z.string().min(1),
});

export type ConfiguracaoDoAcesso = z.infer<typeof configuracaoDoAcesso>;

export type ResultadoDoAcesso =
  | { readonly permitido: true }
  | {
      readonly permitido: false;
      /** 403: sem JWT ou JWT inválido. 503: Access ainda não configurado nesta Worker. */
      readonly status: 403 | 503;
      readonly mensagem: string;
    };

/** Origem das chaves públicas do Access. Injetável para os testes não usarem a rede. */
export type ObterChaves = (dominioDoTime: string) => JWTVerifyGetKey;

const chavesEmCache = new Map<string, JWTVerifyGetKey>();

/**
 * Chaves remotas, buscadas em `<time>.cloudflareaccess.com/cdn-cgi/access/certs`.
 * Guardadas por domínio na Worker para não buscar a cada requisição; a `jose` renova sozinha
 * quando aparece uma chave nova (o Access troca a chave a cada 6 semanas).
 */
export const chavesRemotasDoAccess: ObterChaves = (dominioDoTime) => {
  let chaves = chavesEmCache.get(dominioDoTime);
  if (chaves === undefined) {
    chaves = createRemoteJWKSet(new URL(`${dominioDoTime}/cdn-cgi/access/certs`));
    chavesEmCache.set(dominioDoTime, chaves);
  }
  return chaves;
};

const negado = (status: 403 | 503, mensagem: string): ResultadoDoAcesso => ({
  permitido: false,
  status,
  mensagem,
});

/**
 * Só deixa passar quem apresenta um JWT do Access válido para ESTA aplicação: assinatura RS256,
 * emissor (`iss`), público (`aud`) e validade (`exp`). Na dúvida, recusa.
 */
export async function verificarAcesso(
  request: Request,
  env: unknown,
  obterChaves: ObterChaves = chavesRemotasDoAccess,
): Promise<ResultadoDoAcesso> {
  const token = request.headers.get(CABECALHO_JWT);
  if (token === null || token === "") {
    return negado(403, "Acesso negado: esta área é fechada.");
  }

  const configuracao = configuracaoDoAcesso.safeParse(env);
  if (!configuracao.success) {
    return negado(503, "Acesso fechado ainda não configurado. Por segurança, ninguém entra.");
  }
  const { TEAM_DOMAIN, POLICY_AUD } = configuracao.data;

  try {
    await jwtVerify(token, obterChaves(TEAM_DOMAIN), {
      algorithms: ["RS256"],
      issuer: TEAM_DOMAIN,
      audience: POLICY_AUD,
      clockTolerance: 30,
    });
    return { permitido: true };
  } catch {
    // Qualquer falha (assinatura, vencido, outro emissor, outra aplicação, chaves
    // indisponíveis) vira recusa. O motivo não é devolvido: não ajuda quem tenta forçar.
    return negado(403, "Acesso negado: esta área é fechada.");
  }
}
