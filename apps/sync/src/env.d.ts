/**
 * Ligações da Worker `sync` (ver wrangler.jsonc). Os dois segredos são cadastrados pelo dono com
 * `wrangler secret put`, só pelo prompt interativo; nunca em arquivo.
 */
interface Env {
  readonly DB: D1Database;
  /** A chave pessoal da Garmin. Ausente até o dono cadastrar. */
  readonly GARMIN_API_KEY?: string;
  /** Data de vencimento da chave (AAAA-MM-DD), para o aviso 14 dias antes. */
  readonly GARMIN_CHAVE_VENCE_EM?: string;
  /**
   * Trava mecânica (`vars` do wrangler.jsonc): "sim" libera a sincronização; qualquer outro valor
   * (inclusive ausente) a mantém travada, mesmo com a chave cadastrada. Só muda para "sim" no PR
   * que fechar a #29 (política revista), depois da #22.
   */
  readonly POLITICA_REVISTA?: string;
}
