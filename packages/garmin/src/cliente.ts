import type { ZodType } from "zod";

import { GarminToken, type GarminKey } from "./chave.js";
import { diasDaJanela, ehData } from "./datas.js";
import {
  AcessoNegadoError,
  ChaveInvalidaError,
  GarminIndisponivelError,
  LimiteExcedidoError,
  PedidoRecusadoError,
  RedeGarminError,
  RespostaInesperadaError,
  TokenRecusadoError,
} from "./erros.js";
import {
  detalheDaAtividadeSchema,
  hrvSchema,
  listaDeAtividadesSchema,
  perfilSchema,
  resumosDiariosSchema,
  sonoSchema,
  tokenSchema,
  zonasSchema,
} from "./esquemas.js";
import {
  ATIVIDADES_POR_PAGINA,
  ESPERA_MAXIMA_APOS_429_S,
  ESPERA_PADRAO_APOS_429_S,
  JANELA_DIAS,
  MARGEM_DO_TOKEN_MS,
  PAUSA_ENTRE_REQUISICOES_MS,
  TAMANHO_MAXIMO_DA_RESPOSTA,
  URL_BASE_PADRAO,
  VALIDADE_DO_TOKEN_MS,
} from "./limites.js";
import type {
  AtividadeGarmin,
  DiaHrvGarmin,
  DiaResumoGarmin,
  DiaSonoGarmin,
  Fluxo,
  OrigemDeFc,
  PerfilGarmin,
  ZonaFcGarmin,
} from "./tipos.js";

/** Onde o token fica entre chamadas. Só memória: o token nunca vai para banco nem log. */
export interface CacheDeToken {
  atual: GarminToken | null;
}

export function criarCacheDeToken(): CacheDeToken {
  return { atual: null };
}

export interface OpcoesDoCliente {
  readonly chave: GarminKey;
  /** Só os testes trocam estas quatro. */
  readonly fetch?: typeof fetch;
  /** Relógio em milissegundos. */
  readonly agora?: () => number;
  readonly dormir?: (ms: number) => Promise<void>;
  readonly urlBase?: string;
  /** Passe o mesmo cache em várias execuções do mesmo processo para reaproveitar o token. */
  readonly cacheDeToken?: CacheDeToken;
}

export interface JanelaDeDatas {
  /** Primeiro dia, inclusive (`YYYY-MM-DD`). */
  readonly de: string;
  /** Último dia, inclusive. */
  readonly ate: string;
}

export interface PaginaDeAtividades extends JanelaDeDatas {
  /** Posição da primeira atividade da página (zero é a primeira). */
  readonly inicio: number;
  readonly limite?: number;
}

export interface ClienteGarmin {
  /** A atividade mais antiga da conta, ou `null` se não há nenhuma. Sem janela de datas. */
  primeiraAtividade(): Promise<AtividadeGarmin | null>;
  atividades(pagina: PaginaDeAtividades): Promise<AtividadeGarmin[]>;
  origemDeFc(atividadeId: number): Promise<OrigemDeFc>;
  zonasDeFc(): Promise<ZonaFcGarmin[]>;
  perfil(): Promise<PerfilGarmin>;
  hrv(janela: JanelaDeDatas): Promise<DiaHrvGarmin[]>;
  sono(janela: JanelaDeDatas): Promise<DiaSonoGarmin[]>;
  resumosDiarios(janela: JanelaDeDatas): Promise<DiaResumoGarmin[]>;
  /** Quantas requisições HTTP já foram feitas (inclui a troca da chave por token). */
  requisicoesFeitas(): number;
}

/** Recusa janela maior que a configurada para o fluxo: protege contra erro de quem chama. */
export function validarJanela(fluxo: Fluxo, { de, ate }: JanelaDeDatas): void {
  if (!ehData(de) || !ehData(ate)) {
    throw new RangeError("As datas da janela precisam estar no formato AAAA-MM-DD.");
  }
  const dias = diasDaJanela(de, ate);
  if (dias < 1) throw new RangeError("A janela termina antes de começar.");
  if (dias > JANELA_DIAS[fluxo]) {
    throw new RangeError(
      `Janela de ${String(dias)} dias passa do limite de ${String(JANELA_DIAS[fluxo])} dias para ${fluxo}.`,
    );
  }
}

/** Segundos pedidos pela Garmin no `Retry-After` (número ou data), dentro de limites seguros. */
function segundosDeEspera(cabecalho: string | null, agoraMs: number): number {
  let segundos = ESPERA_PADRAO_APOS_429_S;
  if (cabecalho !== null && cabecalho.trim() !== "") {
    const numerico = Number(cabecalho);
    if (Number.isFinite(numerico)) {
      segundos = numerico;
    } else {
      const data = Date.parse(cabecalho);
      if (!Number.isNaN(data)) segundos = Math.ceil((data - agoraMs) / 1000);
    }
  }
  return Math.min(Math.max(Math.ceil(segundos), 1), ESPERA_MAXIMA_APOS_429_S);
}

const dormirDeVerdade = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

export function criarClienteGarmin(opcoes: OpcoesDoCliente): ClienteGarmin {
  const { chave } = opcoes;
  const buscar = opcoes.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const agora = opcoes.agora ?? (() => Date.now());
  const dormir = opcoes.dormir ?? dormirDeVerdade;
  const urlBase = opcoes.urlBase ?? URL_BASE_PADRAO;
  const cache = opcoes.cacheDeToken ?? criarCacheDeToken();

  let requisicoes = 0;
  let ultimaRequisicaoEm: number | null = null;

  /**
   * Toda requisição passa por aqui: respeita a pausa mínima, traduz falha de rede e NUNCA segue
   * redirecionamento (`redirect: "manual"`): o cabeçalho `Authorization` leva a chave ou o token,
   * e a API da Garmin não documenta nenhum redirecionamento. Qualquer 3xx vira erro.
   */
  async function enviar(url: string, init: RequestInit, endpoint: string): Promise<Response> {
    if (ultimaRequisicaoEm !== null) {
      const falta = ultimaRequisicaoEm + PAUSA_ENTRE_REQUISICOES_MS - agora();
      if (falta > 0) await dormir(falta);
    }
    ultimaRequisicaoEm = agora();
    requisicoes += 1;
    let resposta: Response;
    try {
      resposta = await buscar(url, { ...init, redirect: "manual" });
    } catch {
      // Nada da exceção original é repassado: ela poderia trazer a URL ou cabeçalhos.
      throw new RedeGarminError();
    }
    if (resposta.status >= 300 && resposta.status < 400) {
      throw new PedidoRecusadoError(endpoint, resposta.status);
    }
    return resposta;
  }

  async function lerJson(resposta: Response, endpoint: string): Promise<unknown> {
    const declarado = Number(resposta.headers.get("Content-Length") ?? 0);
    if (declarado > TAMANHO_MAXIMO_DA_RESPOSTA) {
      throw new RespostaInesperadaError(endpoint, ["tamanho"]);
    }
    try {
      const texto = await resposta.text();
      if (texto.length > TAMANHO_MAXIMO_DA_RESPOSTA) {
        throw new RespostaInesperadaError(endpoint, ["tamanho"]);
      }
      return JSON.parse(texto) as unknown;
    } catch (erro) {
      if (erro instanceof RespostaInesperadaError) throw erro;
      throw new RespostaInesperadaError(endpoint, []);
    }
  }

  /** Falhas HTTP comuns a todos os endpoints (menos 401, tratado por quem chama). */
  function falharPorStatus(resposta: Response, endpoint: string): never {
    if (resposta.status === 429) {
      throw new LimiteExcedidoError(segundosDeEspera(resposta.headers.get("Retry-After"), agora()));
    }
    if (resposta.status >= 500) throw new GarminIndisponivelError(resposta.status);
    if (resposta.status === 403) throw new AcessoNegadoError(endpoint);
    throw new PedidoRecusadoError(endpoint, resposta.status);
  }

  async function pedirToken(): Promise<GarminToken> {
    const endpoint = "/personalapitoken-service/personal-api/personal-api-key/token";
    const resposta = await enviar(
      `${urlBase}${endpoint}`,
      {
        method: "POST",
        headers: { Authorization: chave.cabecalhoDaTroca(), Accept: "application/json" },
      },
      endpoint,
    );
    // A troca não tem entrada variável: qualquer 4xx (menos o 429, que é "espere") quer dizer que
    // a Garmin não aceitou a chave.
    if (resposta.status >= 400 && resposta.status < 500 && resposta.status !== 429) {
      throw new ChaveInvalidaError();
    }
    if (!resposta.ok) falharPorStatus(resposta, endpoint);
    const bruto = await lerJson(resposta, endpoint);
    const analise = tokenSchema.safeParse(bruto);
    if (!analise.success) throw new RespostaInesperadaError(endpoint, ["token"]);
    const { token, expiraEmSegundos } = analise.data;
    const validade = Math.min(
      expiraEmSegundos === null ? VALIDADE_DO_TOKEN_MS : expiraEmSegundos * 1000,
      VALIDADE_DO_TOKEN_MS,
    );
    // O token vale 24 h (FAQ oficial). Pedimos outro um pouco antes, mas nunca com validade < 1 min.
    const util = Math.max(validade - MARGEM_DO_TOKEN_MS, 60_000);
    return new GarminToken(token, agora() + util);
  }

  async function tokenValido(): Promise<GarminToken> {
    const atual = cache.atual;
    if (atual !== null && agora() < atual.expiraEm) return atual;
    cache.atual = await pedirToken();
    return cache.atual;
  }

  interface OpcoesDaConsulta<T> {
    readonly vazioEm204?: T;
    readonly vazioEm404?: T;
  }

  async function consultar<T>(
    endpoint: string,
    caminho: string,
    consulta: Readonly<Record<string, string | number>>,
    esquema: ZodType<T>,
    { vazioEm204, vazioEm404 }: OpcoesDaConsulta<T> = {},
  ): Promise<T> {
    const parametros = new URLSearchParams(
      Object.entries(consulta).map(([nome, valor]) => [nome, String(valor)]),
    ).toString();
    const url = `${urlBase}${caminho}${parametros === "" ? "" : `?${parametros}`}`;

    let renovou = false;
    for (;;) {
      const token = await tokenValido();
      const resposta = await enviar(
        url,
        { headers: { Authorization: token.cabecalho(), Accept: "application/json" } },
        endpoint,
      );
      if (resposta.status === 401) {
        // Token vencido antes da hora: pede outro uma vez. Se a Garmin recusar também o token
        // recém-emitido, a chave está boa (a troca acabou de funcionar): o problema é o jeito de
        // enviar o token, e o aviso ao dono precisa dizer isso, não "chave expirada".
        cache.atual = null;
        if (renovou) throw new TokenRecusadoError();
        renovou = true;
        continue;
      }
      if (resposta.status === 204 && vazioEm204 !== undefined) return vazioEm204;
      if (resposta.status === 404 && vazioEm404 !== undefined) return vazioEm404;
      if (!resposta.ok) falharPorStatus(resposta, endpoint);

      const analise = esquema.safeParse(await lerJson(resposta, endpoint));
      if (!analise.success) {
        // Só os caminhos dos campos: o Zod também poderia citar valores recebidos, que são dados.
        const campos = [
          ...new Set(
            analise.error.issues.map((problema) =>
              problema.path
                .map(String)
                .join(".")
                .replace(/[^A-Za-z0-9_.]/g, "?")
                .slice(0, 80),
            ),
          ),
        ]
          .filter((campo) => campo !== "")
          .slice(0, 5);
        throw new RespostaInesperadaError(endpoint, campos);
      }
      return analise.data;
    }
  }

  return {
    async primeiraAtividade() {
      const lista = await consultar(
        "/activitylist-service/activities/search/activities",
        "/activitylist-service/activities/search/activities",
        { start: 0, limit: 1, sortOrder: "asc" },
        listaDeAtividadesSchema,
        { vazioEm204: [] },
      );
      return lista[0] ?? null;
    },

    async atividades({ de, ate, inicio, limite = ATIVIDADES_POR_PAGINA }) {
      validarJanela("atividades", { de, ate });
      if (!Number.isInteger(inicio) || inicio < 0) throw new RangeError("Posição inválida.");
      if (!Number.isInteger(limite) || limite < 1 || limite > ATIVIDADES_POR_PAGINA) {
        throw new RangeError(`O limite por página vai de 1 a ${String(ATIVIDADES_POR_PAGINA)}.`);
      }
      return consultar(
        "/activitylist-service/activities/search/activities",
        "/activitylist-service/activities/search/activities",
        { startDate: de, endDate: ate, start: inicio, limit: limite, sortOrder: "asc" },
        listaDeAtividadesSchema,
        { vazioEm204: [] },
      );
    },

    async origemDeFc(atividadeId) {
      if (!Number.isSafeInteger(atividadeId) || atividadeId <= 0) {
        throw new RangeError("Identificador de atividade inválido.");
      }
      // Atividade apagada na Garmin (404): não há o que conferir.
      return consultar(
        "/activity-service/activity/{activityId}",
        `/activity-service/activity/${String(atividadeId)}`,
        {},
        detalheDaAtividadeSchema,
        { vazioEm404: "desconhecido" },
      );
    },

    zonasDeFc() {
      return consultar(
        "/biometric-service/heartRateZones/v2",
        "/biometric-service/heartRateZones/v2",
        {},
        zonasSchema,
      );
    },

    perfil() {
      return consultar(
        "/userprofile-service/userprofile/settings",
        "/userprofile-service/userprofile/settings",
        {},
        perfilSchema,
      );
    },

    hrv(janela) {
      validarJanela("hrv", janela);
      return consultar(
        "/hrv-service/hrv/daily/{fromDate}/{toDate}",
        `/hrv-service/hrv/daily/${janela.de}/${janela.ate}`,
        {},
        hrvSchema,
        { vazioEm204: [] },
      );
    },

    sono(janela) {
      validarJanela("sono", janela);
      return consultar(
        "/sleep-service/sleep/dailySleepSummariesByDate",
        "/sleep-service/sleep/dailySleepSummariesByDate",
        { startDate: janela.de, endDate: janela.ate },
        sonoSchema,
        { vazioEm204: [] },
      );
    },

    resumosDiarios(janela) {
      validarJanela("resumo_diario", janela);
      return consultar(
        "/usersummary-service/v2/dailysummaries",
        "/usersummary-service/v2/dailysummaries",
        { startDate: janela.de, endDate: janela.ate },
        resumosDiariosSchema,
        { vazioEm204: [] },
      );
    },

    requisicoesFeitas: () => requisicoes,
  };
}
