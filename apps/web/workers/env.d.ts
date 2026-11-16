/**
 * Variáveis da Worker (ver `vars` em wrangler.jsonc). O domínio do time e a etiqueta AUD do
 * Cloudflare Access não são segredos: aparecem em todo JWT.
 *
 * `EMAILS_PERMITIDOS` hoje só tem o e-mail do projeto, que já é público. Quando entrar o
 * primeiro amigo ela passa a ser secret (`wrangler secret put`), sem mudar o código: e-mail de
 * terceiros não vai para o repositório público (ver docs/decisoes/0005-arquitetura.md).
 */
interface Env {
  readonly TEAM_DOMAIN: string;
  readonly POLICY_AUD: string;
  /**
   * E-mails com acesso a /app, separados por vírgula. Opcional de propósito: quando a lista vira
   * secret ela pode faltar (secret não criado), e a Worker trata isso como 503. Sem lista
   * válida, ninguém entra.
   */
  readonly EMAILS_PERMITIDOS?: string;
  /**
   * Banco D1 da sincronização (o site só lê, por convenção e lint; o binding do D1 permite escrita, e quem escreve é a Worker `sync`). Opcional de
   * propósito: a ligação só existe depois de o dono criar o banco e descomentar o bloco em
   * wrangler.jsonc; sem ela o site abre normalmente e a área fechada diz que a Garmin ainda não
   * foi configurada. Passo a passo em docs/decisoes/0005-arquitetura.md.
   */
  readonly DB?: D1Database;
  /**
   * Ligação interna com a Worker `sync` (botão "Atualizar agora"). Opcional pelo mesmo motivo.
   * A Worker do site NUNCA recebe a chave da Garmin: ela só pede à `sync` que atualize.
   */
  readonly SYNC?: Fetcher;
}
