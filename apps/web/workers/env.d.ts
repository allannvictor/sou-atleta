/**
 * Variáveis da Worker (ver `vars` em wrangler.jsonc). Não são segredos: o domínio do time e a
 * etiqueta AUD do Cloudflare Access aparecem em todo JWT.
 */
interface Env {
  readonly TEAM_DOMAIN: string;
  readonly POLICY_AUD: string;
}
