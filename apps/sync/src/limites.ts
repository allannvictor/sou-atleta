/**
 * Orçamento de cada execução no plano gratuito da Cloudflare (limites conferidos em
 * 15/11/2026 em developers.cloudflare.com/workers/platform/limits e /d1/platform/limits):
 *
 * - 10 ms de CPU por execução, inclusive no Cron Trigger (esperar rede não conta);
 * - 50 subrequests por execução, somando `fetch` e idas ao D1 (um `batch` conta como uma);
 * - 100 mil requisições por dia na conta.
 *
 * Por isso cada execução faz pouco e termina; o que sobra fica para a próxima. Tudo que dá para
 * ajustar mora neste arquivo. O tempo de CPU real NÃO foi medido (não há como medir fora da
 * Cloudflare). Medição de apoio, em Node com o motor aquecido (não é a Cloudflare): ler e
 * validar uma janela custa cerca de 0,5 ms de CPU e montar as gravações de uma janela de 30 dias
 * cerca de 1,5 a 2 ms. Por isso o teto de 3 janelas por execução. Os números são deliberadamente
 * baixos e devem ser conferidos nas primeiras execuções reais (painel da Cloudflare:
 * Observability e Invocation Statuses).
 */

export type Modo = "agendada" | "manual";

/** Subrequests que usamos de no máximo 50 permitidos: folga de 10 para trocas de token e retentativas. */
export const SUBREQUESTS_MAXIMOS = 40;

export interface OrcamentoDoModo {
  /** Requisições à Garmin (inclui a troca da chave por token). */
  readonly garmin: number;
  /** Janelas de datas importadas (cada uma pode ter várias páginas de atividades). */
  readonly janelas: number;
  /** Atividades cuja origem da FC (pulso ou cinta) é conferida na Garmin. */
  readonly conferenciasDeFc: number;
}

export const ORCAMENTO: Readonly<Record<Modo, OrcamentoDoModo>> = {
  // O cron tem até 15 min de relógio, mas só 10 ms de CPU: poucas janelas por vez.
  agendada: { garmin: 20, janelas: 3, conferenciasDeFc: 2 },
  // O botão responde na hora e continua em segundo plano, que dura no máximo 30 s depois da
  // resposta: com a pausa de 1,5 s entre requisições da Garmin, cabem poucas.
  manual: { garmin: 8, janelas: 2, conferenciasDeFc: 1 },
};

/** Cron: a cada 15 minutos. Em `wrangler.jsonc`; o teste confere que os dois combinam. */
export const CRON = "*/15 * * * *";

/** A trava de execução expira sozinha depois disto, se a execução for cortada. */
export const TRAVA_SEGUNDOS = 300;

/** "Atualizar agora" repetido antes deste intervalo é recusado. */
export const INTERVALO_MINIMO_MANUAL_SEGUNDOS = 60;

/** Dias relidos antes do último dia importado, para pegar atividades editadas depois. */
export const SOBREPOSICAO_DIAS = 3;

/** Depois do histórico completo, cada fluxo só é consultado de novo depois deste tempo. */
export const REVERIFICACAO_MINUTOS = {
  atividades: 15,
  resumo_diario: 60,
  sono: 60,
  hrv: 60,
} as const;

/** Chave recusada pela Garmin: só tentamos de novo (no cron) depois deste tempo. */
export const ESPERA_APOS_CHAVE_INVALIDA_SEGUNDOS = 3600;

/** Espera mínima depois do primeiro 429; dobra a cada 429 seguido. */
export const ESPERA_BASE_APOS_429_SEGUNDOS = 900;
export const ESPERA_MAXIMA_APOS_429_SEGUNDOS = 21_600;

/** Perfil e zonas de FC mudam pouco: buscados de novo depois deste tempo. */
export const REVALIDAR_PERFIL_HORAS = 24;

/** Sem nenhuma atividade na conta, o histórico de saúde começa tantos dias atrás. */
export const DIAS_DE_HISTORICO_SEM_ATIVIDADES = 90;
/** Dados de saúde podem ser mais antigos que a primeira atividade. */
export const DIAS_DE_SAUDE_ANTES_DA_PRIMEIRA_ATIVIDADE = 60;
/** Nenhuma busca começa antes disto. */
export const DATA_MINIMA = "2005-01-01";
