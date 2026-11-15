import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

/**
 * Validação do JWT do Cloudflare Access dentro da própria Worker.
 *
 * Por quê: o Access barra quem não tem permissão antes de a requisição chegar aqui, mas se a
 * configuração do painel for desfeita ou errada, o acesso fechado não pode depender só dela.
 * Esta checagem é a segunda trava. Fonte:
 * https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
 *
 * Provar que o JWT veio do Access não diz QUEM entrou: "só o dono" mora na política do painel.
 * Se alguém ampliar essa política por engano (Everyone, "Emails ending in", um grupo), o Access
 * passaria a emitir JWT válido a terceiros. Por isso a Worker também confere o e-mail do token
 * contra a lista `EMAILS_PERMITIDOS`: painel e Worker precisam concordar (issue #11).
 *
 * Premissa: o JWT não diz qual provedor de login o emitiu, então esta checagem supõe que todo
 * provedor ligado à aplicação prova a posse do e-mail (hoje, Google e código por e-mail).
 * Adicionar outro provedor exige revisão de segurança (docs/decisoes/0005-arquitetura.md).
 */

/** Cabeçalho em que o Access entrega o JWT à origem. */
export const CABECALHO_JWT = "Cf-Access-Jwt-Assertion";

const MENSAGEM_DE_RECUSA = "Acesso negado: esta área é fechada.";
const MENSAGEM_SEM_CONFIGURACAO =
  "Acesso fechado ainda não configurado. Por segurança, ninguém entra.";

/**
 * Só as letras A-Z viram minúsculas. `toLowerCase()` também converteria caracteres que não são
 * ASCII em letras ASCII (o símbolo Kelvin, U+212A, vira "k"), e um e-mail diferente passaria a
 * ser tratado como igual. A lista só aceita ASCII (ver `FORMATO_DE_EMAIL`), então isto basta.
 */
const minusculasAscii = (texto: string): string =>
  texto.replace(/[A-Z]/g, (letra) => letra.toLowerCase());

/**
 * Uma entrada da lista de e-mails permitidos: endereço inteiro, só com letras minúsculas (a
 * lista já passou por `minusculasAscii`), dígitos e `. _ % + -`, um `@` e um domínio com ponto.
 * Por isso a regex também recusa aspas, `<` `>`, barra, vírgula, ponto e vírgula, espaço e
 * qualquer caractere fora de ASCII.
 *
 * Duas razões. (1) Nada de curinga (`*@gmail.com`), só domínio (`@gmail.com`) ou texto sem `@`:
 * uma entrada assim vira "termina em", que é exatamente a ampliação por engano que esta trava
 * existe para pegar. (2) Erro de colagem, como o valor entre aspas no prompt do
 * `wrangler secret put`, tem de aparecer como configuração inválida (503) e não como um 403
 * igual ao de um intruso, que mandaria o dono procurar a causa errada. Uma entrada ruim
 * invalida a lista inteira, em vez de ser ignorada em silêncio.
 *
 * O conjunto é de propósito mais estreito que a RFC 5322 (que também aceita, por exemplo, `'`).
 * Se um dia entrar alguém com um desses caracteres, a lista falha alto (503) e a regra se amplia
 * aqui, com teste.
 */
const PARTE_LOCAL = String.raw`[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*`;
// Cada rótulo do domínio: letras e dígitos, com hífen só no meio.
const ROTULO = String.raw`[a-z0-9]+(?:-[a-z0-9]+)*`;
const FORMATO_DE_EMAIL = new RegExp(`^${PARTE_LOCAL}@${ROTULO}(?:\\.${ROTULO})+$`);

/**
 * `EMAILS_PERMITIDOS`: e-mails separados por vírgula. Espaços e vírgulas sobrando são
 * tolerados; lista vazia ou sem nenhum e-mail não passa. Para dar acesso a mais uma pessoa
 * basta editar o valor da variável, sem mexer neste arquivo.
 */
const listaDeEmails = z
  .string()
  .transform((bruto) =>
    bruto
      .split(",")
      .map((entrada) => entrada.trim())
      .filter((entrada) => entrada !== "")
      .map(minusculasAscii),
  )
  .pipe(z.array(z.string().regex(FORMATO_DE_EMAIL)).min(1));

/**
 * Domínio do time: é o `iss` do token e a origem de onde vêm as chaves públicas.
 * Só aceitamos o formato real do Access (https, sem barra no fim), para um valor errado na
 * configuração fazer a rota recusar todo mundo em vez de confiar em outro emissor.
 */
const configuracaoDoAcesso = z.object({
  TEAM_DOMAIN: z.string().regex(/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/),
  POLICY_AUD: z.string().min(1),
  EMAILS_PERMITIDOS: listaDeEmails,
});

export type ConfiguracaoDoAcesso = z.infer<typeof configuracaoDoAcesso>;

export type ResultadoDoAcesso =
  | { readonly permitido: true }
  | {
      readonly permitido: false;
      /**
       * 403: sem JWT, JWT inválido ou e-mail fora da lista. 503: chegou um JWT, mas esta Worker
       * ainda não tem o domínio do time, a etiqueta AUD e uma lista válida de e-mails permitidos
       * (`vars` do wrangler.jsonc, ou secret quando a lista passar a ter e-mail de terceiros).
       */
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
 * Só deixa passar quem apresenta um JWT do Access válido para ESTA aplicação (assinatura RS256,
 * emissor `iss`, público `aud`, validade `exp`), com `type` "app" e e-mail em
 * `EMAILS_PERMITIDOS`. Na dúvida, recusa.
 *
 * O e-mail só é lido depois de a assinatura ser provada: um token forjado nunca chega a ser
 * comparado com a lista. A comparação ignora maiúsculas e exige o endereço inteiro igual: sem
 * curinga, sem "termina em", sem tratar pontos ou `+` do Gmail como iguais.
 *
 * Ordem das checagens (de propósito): primeiro o cabeçalho, depois a configuração. Quem chega
 * sem JWT recebe sempre 403, esteja o Access configurado ou não, então a Worker não revela a
 * um visitante anônimo que a configuração ainda falta. O 503 só aparece para quem já apresenta
 * um JWT (ou seja, depois que o Access existe no painel) e a Worker não tem o domínio do time
 * e a etiqueta AUD preenchidos ou a lista de e-mails está ausente ou malformada: ninguém entra,
 * e o dono vê que falta o passo de configuração.
 */
export async function verificarAcesso(
  request: Request,
  env: unknown,
  obterChaves: ObterChaves = chavesRemotasDoAccess,
): Promise<ResultadoDoAcesso> {
  const token = request.headers.get(CABECALHO_JWT);
  if (token === null || token === "") {
    return negado(403, MENSAGEM_DE_RECUSA);
  }

  const configuracao = configuracaoDoAcesso.safeParse(env);
  if (!configuracao.success) {
    return negado(503, MENSAGEM_SEM_CONFIGURACAO);
  }
  const { TEAM_DOMAIN, POLICY_AUD, EMAILS_PERMITIDOS } = configuracao.data;

  try {
    const { payload } = await jwtVerify(token, obterChaves(TEAM_DOMAIN), {
      algorithms: ["RS256"],
      issuer: TEAM_DOMAIN,
      audience: POLICY_AUD,
      clockTolerance: 30,
      // Sem isto a `jose` só confere `exp` se ele existir no token: um JWT sem validade seria
      // aceito para sempre. O Access sempre emite os dois.
      requiredClaims: ["exp", "iat"],
    });
    // `type` "app" recusa tokens de outros fluxos do Access (por exemplo o de organização), mas
    // NÃO distingue pessoa de token de serviço: o de serviço também vem com `type` "app". Quem o
    // barra é a falta de `email` (ele traz `common_name`, sem e-mail). Por isso a checagem de
    // e-mail abaixo não pode ser afrouxada achando que o `type` já basta. E-mail ausente, vazio
    // ou que não seja texto nunca está na lista (a lista não tem entrada vazia): mesma recusa.
    const email = payload["email"];
    if (
      payload["type"] !== "app" ||
      typeof email !== "string" ||
      !EMAILS_PERMITIDOS.includes(minusculasAscii(email))
    ) {
      return negado(403, MENSAGEM_DE_RECUSA);
    }
    return { permitido: true };
  } catch {
    // Qualquer falha (assinatura, vencido, outro emissor, outra aplicação, chaves
    // indisponíveis) vira recusa. O motivo não é devolvido: não ajuda quem tenta forçar.
    return negado(403, MENSAGEM_DE_RECUSA);
  }
}
