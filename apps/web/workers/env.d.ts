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
  /** E-mails com acesso a /app, separados por vírgula. Sem lista válida, ninguém entra. */
  readonly EMAILS_PERMITIDOS: string;
}
