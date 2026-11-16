import type { Fluxo } from "./tipos.js";

/**
 * Limites da Garmin e folgas que o conector se impõe. Fonte, fatos e inferências estão em
 * `docs/pesquisa/garmin-limites-api-2026-11.md`.
 *
 * **Fato (Swagger oficial da Personal API, lido em 15/11/2026):** o tamanho máximo de janela de
 * datas está escrito para alguns endpoints. Para os outros, e para a taxa de requisições, a
 * Garmin não publica valor (nem na página da API, nem no FAQ, nem na visão geral do programa).
 * Onde não há valor, as constantes abaixo são folgas conservadoras NOSSAS, não limites da Garmin.
 */

/** Tamanho máximo de janela, em dias, escrito no Swagger oficial. Ausente = a Garmin não diz. */
export const JANELA_MAXIMA_OFICIAL_DIAS: Readonly<Partial<Record<Fluxo, number>>> = {
  sono: 31, // dailySleepSummariesByDate: "up to a maximum of 31 days"
  resumo_diario: 366, // v2/dailysummaries: "up to a maximum of 1 year"
};

/**
 * Menor janela máxima que o Swagger declara para qualquer endpoint de saúde (passos e estresse,
 * 28 dias). Serve de teto para os fluxos em que a Garmin não declara limite.
 */
export const MENOR_JANELA_OFICIAL_CONHECIDA_DIAS = 28;

/** Janela usada em cada fluxo, em dias. Pequena de propósito: ver CPU na pesquisa. */
export const JANELA_DIAS: Readonly<Record<Fluxo, number>> = {
  atividades: 14,
  resumo_diario: 30,
  sono: 10,
  hrv: 14,
};

/** Fração máxima da janela oficial que aceitamos usar (folga de pelo menos metade). */
export const FRACAO_MAXIMA_DA_JANELA_OFICIAL = 0.5;

/** Atividades por página. O Swagger usa 99 como padrão; ficamos bem abaixo. */
export const ATIVIDADES_POR_PAGINA = 20;

/**
 * Pausa mínima entre duas requisições à Garmin, em milissegundos. A Garmin não publica a taxa
 * permitida; 1,5 s dá no máximo 40 requisições por minuto, muito abaixo de qualquer limite
 * razoável para uma conta pessoal (inferência, não fato).
 */
export const PAUSA_ENTRE_REQUISICOES_MS = 1500;

/** Espera usada depois de um 429 sem `Retry-After`, e o teto para qualquer `Retry-After`. */
export const ESPERA_PADRAO_APOS_429_S = 900;
export const ESPERA_MAXIMA_APOS_429_S = 21_600;

/** O token vale 24 horas (FAQ oficial); pedimos outro um pouco antes de vencer. */
export const VALIDADE_DO_TOKEN_MS = 24 * 60 * 60 * 1000;
export const MARGEM_DO_TOKEN_MS = 5 * 60 * 1000;

/** Resposta maior que isto é recusada antes de ser lida (protege memória e CPU do plano gratuito). */
export const TAMANHO_MAXIMO_DA_RESPOSTA = 1_000_000;

export const URL_BASE_PADRAO = "https://personal.connectapi.garmin.com";
