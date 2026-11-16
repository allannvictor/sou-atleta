import { INTERVALO_MINIMO_AO_ABRIR_SEGUNDOS } from "@sou-atleta/db";

/**
 * Orçamento de cada execução no plano gratuito da Cloudflare (limites conferidos em
 * 15/11/2026 em developers.cloudflare.com/workers/platform/limits e /d1/platform/limits):
 *
 * - 10 ms de CPU por execução (esperar rede não conta);
 * - 50 subrequests por execução, somando `fetch` e idas ao D1 (um `batch` conta como uma);
 * - 100 mil requisições por dia na conta.
 *
 * Não há rotina agendada (decisão do dono, 16/11/2026): a sincronização roda quando o dono abre
 * a área fechada (`ao_abrir`) e quando aperta "Atualizar agora" (`manual`). Cada execução faz
 * pouco e termina; o que sobra fica para a próxima abertura ou clique. Tudo que dá para ajustar
 * mora neste arquivo.
 *
 * O tempo de CPU real NÃO foi medido (só dá para medir na Cloudflare). Medição de apoio, em Node
 * com o motor aquecido (não é a Cloudflare): ler e validar uma janela custa cerca de 0,5 ms de
 * CPU e montar as gravações de uma janela de 30 dias, cerca de 1,5 a 2 ms. Por isso o teto de
 * 2 janelas por execução, a subir só depois de ver o CPU real (painel da Cloudflare:
 * Observability e Invocation Statuses).
 */

export type Modo = "ao_abrir" | "manual";

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
  // Roda em segundo plano, sem ninguém esperando: o mínimo.
  ao_abrir: { garmin: 8, janelas: 2, conferenciasDeFc: 1 },
  // O botão espera a resposta (com a pausa de 1,5 s entre requisições, até uns 12 s).
  manual: { garmin: 8, janelas: 2, conferenciasDeFc: 2 },
};

/** Abrir a página só pede sincronização depois deste intervalo (vem do `db`: o site confere igual). */
export { INTERVALO_MINIMO_AO_ABRIR_SEGUNDOS };

/** "Atualizar agora" repetido antes deste intervalo é recusado. */
export const INTERVALO_MINIMO_MANUAL_SEGUNDOS = 60;

/** A trava de execução expira sozinha depois disto, se a execução for cortada. */
export const TRAVA_SEGUNDOS = 300;

/** Dias relidos antes do último dia sincronizado, para pegar atividades editadas depois. */
export const SOBREPOSICAO_DIAS = 3;

/** Chave recusada ou token recusado: ao abrir a página só tentamos de novo depois disto. */
export const ESPERA_APOS_RECUSA_SEGUNDOS = 3600;

/** Espera mínima depois do primeiro 429; dobra a cada 429 seguido. */
export const ESPERA_BASE_APOS_429_SEGUNDOS = 900;
export const ESPERA_MAXIMA_APOS_429_SEGUNDOS = 21_600;

/** Perfil e zonas de FC mudam pouco: buscados de novo depois deste tempo. */
export const REVALIDAR_PERFIL_HORAS = 24;
