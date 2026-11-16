import { somarDias } from "../datas.js";

/**
 * Garmin de mentira para os testes: um `fetch` que responde no formato do Swagger oficial da
 * Personal API, com dados SINTÉTICOS (nada vem de conta real). Serve aos testes do conector e da
 * sincronização. Só testes importam este arquivo.
 *
 * Os dados brutos trazem de propósito os campos que o app NÃO pode guardar (GPS, nome do local,
 * nome da pessoa, e-mail, foto): os testes procuram esses valores no banco e nos logs.
 */

/** Valores que jamais podem aparecer em banco, log ou erro. */
export const VALORES_PROIBIDOS = [
  "-23.5505199",
  "-46.6333094",
  "Parque Secreto",
  "Fulano de Tal",
  "fulano.secreto",
  "https://fotos.exemplo.test/fulano.jpg",
] as const;

export interface AtividadeBruta {
  readonly activityId: number;
  readonly [campo: string]: unknown;
}

/** Dia de cada atividade falsa, para o filtro por janela funcionar mesmo com `startTimeLocal` quebrado. */
const diaDaAtividade = new WeakMap<object, string>();

export function atividadeBruta(
  id: number,
  dataLocal: string,
  extras: Record<string, unknown> = {},
): AtividadeBruta {
  const atividade = {
    activityId: id,
    activityName: "Corrida no Parque Secreto",
    description: "Treino com Fulano de Tal",
    startTimeLocal: `${dataLocal} 07:00:00`,
    startTimeGMT: `${dataLocal} 10:00:00`,
    activityType: { typeId: 1, typeKey: "running", parentTypeId: 17 },
    eventType: { typeId: 9, typeKey: "uncategorized" },
    distance: 10_000 + (id % 7) * 100,
    duration: 3000 + (id % 11),
    elapsedDuration: 3100,
    averageHR: 150 + (id % 9),
    maxHR: 178,
    hrTimeInZone_1: 60,
    hrTimeInZone_2: 600,
    hrTimeInZone_3: 1500,
    hrTimeInZone_4: 700,
    hrTimeInZone_5: 140,
    vO2MaxValue: 52,
    aerobicTrainingEffect: 3.4,
    anaerobicTrainingEffect: 0.5,
    startLatitude: -23.5505199,
    startLongitude: -46.6333094,
    endLatitude: -23.5505199,
    endLongitude: -46.6333094,
    locationName: "Parque Secreto",
    ownerFullName: "Fulano de Tal",
    ownerDisplayName: "fulano.secreto",
    ownerProfileImageUrlLarge: "https://fotos.exemplo.test/fulano.jpg",
    hasPolyline: true,
    ...extras,
  };
  diaDaAtividade.set(atividade, dataLocal);
  return atividade;
}

export interface DadosDaGarmin {
  readonly atividades: readonly AtividadeBruta[];
  /** Dias com dados de saúde (`YYYY-MM-DD`). */
  readonly diasDeSaude: readonly string[];
  /** Sensores devolvidos no detalhe de cada atividade (por id); sem entrada, lista vazia. */
  readonly sensores?: Readonly<Record<number, readonly Record<string, unknown>[]>>;
}

const dadoDeHrv = (data: string) => ({
  calendarDate: data,
  weeklyAvg: 62,
  lastNightAvg: 60,
  lastNight5MinHigh: 90,
  status: "BALANCED",
  feedbackPhrase: "HRV_BALANCED_1",
  createTimeStamp: `${data}T06:00:00.0`,
});

const dadoDeSono = (data: string) => ({
  calendarDate: data,
  sleepTimeSeconds: 27_000,
  deepSleepSeconds: 5400,
  lightSleepSeconds: 14_400,
  remSleepSeconds: 5400,
  awakeSleepSeconds: 1800,
  userNote: "Nota pessoal secreta",
});

const dadoDeResumo = (data: string) => ({
  uuid: "123e4567-e89b-12d3-a456-426655440000",
  userProfilePk: 987_654_321,
  calendarDate: data,
  source: "garmin",
  heartRate: { minValue: 45, maxValue: 160, restingValue: 52, alertCount: 0 },
  stress: { avgLevel: 31, maxLevel: 88, qualifier: "balanced" },
  bodyBattery: {
    minValue: 12,
    maxValue: 96,
    chargedValue: 70,
    drainedValue: 65,
    endOfDayValue: 25,
  },
});

export interface FalhaForcada {
  readonly status: number;
  readonly cabecalhos?: Record<string, string>;
  /** Quantas vezes responder assim; sem valor, para sempre. */
  vezes?: number;
}

export interface RequisicaoRegistrada {
  readonly metodo: string;
  readonly caminho: string;
  readonly consulta: Readonly<Record<string, string>>;
  readonly autorizacao: string | null;
}

export interface OpcoesDaGarminFalsa {
  readonly chave: string;
  readonly dados: DadosDaGarmin;
  /** Relógio dos testes (ms). Os tokens da Garmin falsa vencem em 24 h por ele. */
  readonly agora: () => number;
}

export interface GarminFalsa {
  readonly fetch: typeof fetch;
  readonly requisicoes: RequisicaoRegistrada[];
  readonly tokensEmitidos: () => string[];
  /** Revoga a chave: a troca por token passa a dar 401. */
  revogarChave(): void;
  /** Passa a responder com este erro nos caminhos que contêm o trecho. */
  forcarFalha(trecho: string, falha: FalhaForcada): void;
  limparFalhas(): void;
  /** Troca os dados (por exemplo, uma atividade nova chegou). */
  trocarDados(dados: DadosDaGarmin): void;
}

const json = (corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json", ...cabecalhos },
  });

export function criarGarminFalsa(opcoes: OpcoesDaGarminFalsa): GarminFalsa {
  let dados = opcoes.dados;
  let revogada = false;
  const requisicoes: RequisicaoRegistrada[] = [];
  const tokens = new Map<string, number>();
  const falhas = new Map<string, FalhaForcada>();

  const dentro = (dia: string, de: string, ate: string) => dia >= de && dia <= ate;
  const dias = (de: string, ate: string) => dados.diasDeSaude.filter((d) => dentro(d, de, ate));

  const responder = (caminho: string, consulta: Record<string, string>): Response => {
    if (caminho === "/activitylist-service/activities/search/activities") {
      const de = consulta["startDate"] ?? "0000-00-00";
      const ate = consulta["endDate"] ?? "9999-99-99";
      const todas = dados.atividades
        .filter((a) => dentro(diaDaAtividade.get(a) ?? "", de, ate))
        .sort((a, b) => (diaDaAtividade.get(a) ?? "").localeCompare(diaDaAtividade.get(b) ?? ""));
      const inicio = Number(consulta["start"] ?? 0);
      const limite = Number(consulta["limit"] ?? 99);
      return json(todas.slice(inicio, inicio + limite));
    }
    const detalhe = /^\/activity-service\/activity\/(\d+)$/.exec(caminho);
    if (detalhe !== null) {
      const id = Number(detalhe[1]);
      if (!dados.atividades.some((a) => a.activityId === id))
        return new Response(null, { status: 404 });
      return json({
        activityId: id,
        activityName: "Corrida no Parque Secreto",
        metadataDTO: { sensors: dados.sensores?.[id] ?? [] },
        summaryDTO: { startLatitude: -23.5505199, startLongitude: -46.6333094 },
      });
    }
    if (caminho === "/biometric-service/heartRateZones/v2") {
      return json([
        {
          trainingMethod: "HR_RESERVE",
          restingHeartRateUsed: 50,
          lactateThresholdHeartRateUsed: 170,
          zone1Floor: 100,
          zone2Floor: 120,
          zone3Floor: 140,
          zone4Floor: 160,
          zone5Floor: 175,
          maxHeartRateUsed: 188,
          restingHrAutoUpdateUsed: true,
          sport: "DEFAULT",
        },
      ]);
    }
    if (caminho === "/userprofile-service/userprofile/settings") {
      return json({
        displayName: "fulano.secreto",
        measurementSystem: "metric",
        timeZone: "America/Sao_Paulo",
        availableTrainingDays: ["monday", "wednesday", "saturday"],
        preferredLongTrainingDays: ["saturday"],
      });
    }
    const hrv = /^\/hrv-service\/hrv\/daily\/([\d-]+)\/([\d-]+)$/.exec(caminho);
    if (hrv !== null) {
      const lista = dias(hrv[1] ?? "", hrv[2] ?? "");
      if (lista.length === 0) return new Response(null, { status: 204 });
      return json({ hrvSummaries: lista.map(dadoDeHrv), userProfilePk: 987_654_321 });
    }
    if (caminho === "/sleep-service/sleep/dailySleepSummariesByDate") {
      return json(dias(consulta["startDate"] ?? "", consulta["endDate"] ?? "").map(dadoDeSono));
    }
    if (caminho === "/usersummary-service/v2/dailysummaries") {
      return json({
        data: dias(consulta["startDate"] ?? "", consulta["endDate"] ?? "").map(dadoDeResumo),
      });
    }
    return new Response(null, { status: 404 });
  };

  const fakeFetch = (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(
      typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url,
    );
    const consulta = Object.fromEntries(url.searchParams);
    const cabecalhos = new Headers(init?.headers);
    const autorizacao = cabecalhos.get("Authorization");
    const metodo = init?.method ?? "GET";
    requisicoes.push({ metodo, caminho: url.pathname, consulta, autorizacao });

    for (const [trecho, falha] of falhas) {
      if (url.pathname.includes(trecho)) {
        if (falha.vezes !== undefined) {
          falha.vezes -= 1;
          if (falha.vezes <= 0) falhas.delete(trecho);
        }
        return Promise.resolve(
          new Response(null, { status: falha.status, headers: falha.cabecalhos ?? {} }),
        );
      }
    }

    if (url.pathname === "/personalapitoken-service/personal-api/personal-api-key/token") {
      if (metodo !== "POST" || revogada || autorizacao !== `ApiKey ${opcoes.chave}`) {
        return Promise.resolve(json({ message: "Unauthorized" }, 401));
      }
      const token = `token-falso-${String(tokens.size + 1)}`;
      tokens.set(token, opcoes.agora() + 24 * 60 * 60 * 1000);
      return Promise.resolve(
        json({ access_token: token, token_type: "Bearer", expires_in: 86_400 }),
      );
    }

    const token = autorizacao?.startsWith("Bearer ") === true ? autorizacao.slice(7) : "";
    const venceEm = tokens.get(token);
    if (revogada || venceEm === undefined || opcoes.agora() >= venceEm) {
      return Promise.resolve(json({ message: "Unauthorized" }, 401));
    }
    return Promise.resolve(responder(url.pathname, consulta));
  };

  return {
    fetch: fakeFetch,
    requisicoes,
    tokensEmitidos: () => [...tokens.keys()],
    revogarChave: () => {
      revogada = true;
    },
    forcarFalha: (trecho, falha) => {
      falhas.set(trecho, { ...falha });
    },
    limparFalhas: () => {
      falhas.clear();
    },
    trocarDados: (novos) => {
      dados = novos;
    },
  };
}

/** `n` dias consecutivos a partir de `inicio`. */
export function diasSeguidos(inicio: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somarDias(inicio, i));
}
