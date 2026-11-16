import { z } from "zod";

import type {
  AtividadeGarmin,
  DiaHrvGarmin,
  DiaResumoGarmin,
  DiaSonoGarmin,
  OrigemDeFc,
  PerfilGarmin,
  ZonaFcGarmin,
} from "./tipos.js";

/**
 * Validação de tudo que a Garmin devolve (Swagger oficial da Personal API, 15/11/2026).
 *
 * Cada esquema é uma LISTA DE CAMPOS PERMITIDOS: o Zod descarta o que não está listado e o
 * `transform` monta um objeto novo só com o que a decisão 0007 deixa guardar. Latitude,
 * longitude, nome do local, nome da pessoa, e-mail, foto e identificadores de conta chegam na
 * resposta da Garmin, mas não existem aqui, então não saem do pacote.
 *
 * Campo opcional que a Garmin manda vazio (`null` ou ausente) vira `null`. Campo obrigatório
 * que falta, ou de tipo errado, rejeita a resposta inteira (`RespostaInesperadaError`): nunca se
 * inventa valor.
 */

const numero = z
  .number()

  .nullish()
  .transform((valor) => valor ?? null);
/**
 * Número que só vale dentro de uma faixa. A Garmin usa valores como -1 ou -2 para "sem dados" e 0
 * para "sem sensor": guardar isso como medida real falsearia as métricas, então vira `null`.
 */
const numeroEm = (minimo: number, maximo: number) =>
  z
    .number()
    .nullish()
    .transform((valor) =>
      valor !== null && valor !== undefined && valor >= minimo && valor <= maximo ? valor : null,
    );
const fcValida = numeroEm(1, 300);
const nivel0a100 = numeroEm(0, 100);

/** Texto curto vindo da Garmin (códigos e nomes de tipo). O limite protege o banco e a CPU. */
const texto = z
  .string()
  .max(100)
  .nullish()
  .transform((valor) => valor ?? null);

/** Listas vindas da Garmin têm tamanho máximo, bem acima do que as janelas pedem. */
const MAXIMO_DE_ITENS = 400;

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Data e hora sem texto extra no fim (aceita frações de segundo).
const dataEHora = z.string().regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/);

const FONTE = "garmin" as const;

export const atividadeSchema = z
  .object({
    activityId: z.number().int().positive(),
    startTimeLocal: dataEHora,
    startTimeGMT: dataEHora,
    activityType: z.object({ typeKey: z.string().min(1).max(100) }),
    duration: z.number().nonnegative(),
    distance: numero,
    averageHR: fcValida,
    maxHR: fcValida,
    hrTimeInZone_1: numero,
    hrTimeInZone_2: numero,
    hrTimeInZone_3: numero,
    hrTimeInZone_4: numero,
    hrTimeInZone_5: numero,
    vO2MaxValue: numero,
    aerobicTrainingEffect: numero,
    anaerobicTrainingEffect: numero,
  })
  .transform((a): AtividadeGarmin => ({
    fonte: FONTE,
    id: a.activityId,
    dataLocal: a.startTimeLocal.slice(0, 10),
    inicioLocal: a.startTimeLocal,
    inicioGmt: a.startTimeGMT,
    tipo: a.activityType.typeKey,
    duracaoS: a.duration,
    distanciaM: a.distance,
    fcMedia: a.averageHR,
    fcMaxima: a.maxHR,
    tempoZona1S: a.hrTimeInZone_1,
    tempoZona2S: a.hrTimeInZone_2,
    tempoZona3S: a.hrTimeInZone_3,
    tempoZona4S: a.hrTimeInZone_4,
    tempoZona5S: a.hrTimeInZone_5,
    vo2max: a.vO2MaxValue,
    efeitoAerobico: a.aerobicTrainingEffect,
    efeitoAnaerobico: a.anaerobicTrainingEffect,
  }));
export const listaDeAtividadesSchema = z.array(atividadeSchema).max(MAXIMO_DE_ITENS);

const diaDeHrvSchema = z
  .object({
    calendarDate: dia,
    lastNightAvg: numero,
    weeklyAvg: numero,
    lastNight5MinHigh: numero,
    status: texto,
  })
  .transform((h): DiaHrvGarmin => ({
    fonte: FONTE,
    data: h.calendarDate,
    hrvNoiteMs: h.lastNightAvg,
    hrvSemanaMs: h.weeklyAvg,
    hrvPico5minMs: h.lastNight5MinHigh,
    estado: h.status,
  }));
export const hrvSchema = z
  .object({ hrvSummaries: z.array(diaDeHrvSchema).max(MAXIMO_DE_ITENS) })
  .transform((r) => r.hrvSummaries);

const diaDeSonoSchema = z
  .object({
    calendarDate: dia,
    sleepTimeSeconds: numero,
    deepSleepSeconds: numero,
    lightSleepSeconds: numero,
    remSleepSeconds: numero,
    awakeSleepSeconds: numero,
  })
  .transform((s): DiaSonoGarmin => ({
    fonte: FONTE,
    data: s.calendarDate,
    sonoS: s.sleepTimeSeconds,
    profundoS: s.deepSleepSeconds,
    leveS: s.lightSleepSeconds,
    remS: s.remSleepSeconds,
    acordadoS: s.awakeSleepSeconds,
  }));
export const sonoSchema = z.array(diaDeSonoSchema).max(MAXIMO_DE_ITENS);

const diaDeResumoSchema = z
  .object({
    calendarDate: dia,
    heartRate: z.object({ restingValue: fcValida }).nullish(),
    stress: z.object({ avgLevel: nivel0a100, maxLevel: nivel0a100 }).nullish(),
    bodyBattery: z
      .object({
        minValue: nivel0a100,
        maxValue: nivel0a100,
        chargedValue: nivel0a100,
        drainedValue: nivel0a100,
        endOfDayValue: nivel0a100,
      })
      .nullish(),
  })
  .transform((r): DiaResumoGarmin => ({
    fonte: FONTE,
    data: r.calendarDate,
    fcRepouso: r.heartRate?.restingValue ?? null,
    estresseMedio: r.stress?.avgLevel ?? null,
    estresseMaximo: r.stress?.maxLevel ?? null,
    bodyBatteryMin: r.bodyBattery?.minValue ?? null,
    bodyBatteryMax: r.bodyBattery?.maxValue ?? null,
    bodyBatteryCarregada: r.bodyBattery?.chargedValue ?? null,
    bodyBatteryDrenada: r.bodyBattery?.drainedValue ?? null,
    bodyBatteryFimDoDia: r.bodyBattery?.endOfDayValue ?? null,
  }));
export const resumosDiariosSchema = z
  .object({ data: z.array(diaDeResumoSchema).max(MAXIMO_DE_ITENS) })
  .transform((r) => r.data);

const zonaSchema = z
  .object({
    sport: texto,
    trainingMethod: texto,
    maxHeartRateUsed: fcValida,
    restingHeartRateUsed: fcValida,
    lactateThresholdHeartRateUsed: fcValida,
    zone1Floor: z.number(),
    zone2Floor: z.number(),
    zone3Floor: z.number(),
    zone4Floor: z.number(),
    zone5Floor: z.number(),
  })
  .transform((z1): ZonaFcGarmin => ({
    fonte: FONTE,
    esporte: z1.sport ?? "DEFAULT",
    metodo: z1.trainingMethod,
    fcMaxima: z1.maxHeartRateUsed,
    fcRepouso: z1.restingHeartRateUsed,
    fcLimiar: z1.lactateThresholdHeartRateUsed,
    zona1Piso: z1.zone1Floor,
    zona2Piso: z1.zone2Floor,
    zona3Piso: z1.zone3Floor,
    zona4Piso: z1.zone4Floor,
    zona5Piso: z1.zone5Floor,
  }));
export const zonasSchema = z.array(zonaSchema).max(50);

const listaDeDias = z
  .array(z.string().max(20))
  .max(14)
  .nullish()
  .transform((dias) => (dias === null || dias === undefined ? null : JSON.stringify(dias)));

/** Perfil: só parâmetros de treino. `displayName` e o resto não estão na lista, então somem. */
export const perfilSchema = z
  .object({
    measurementSystem: texto,
    timeZone: texto,
    availableTrainingDays: listaDeDias,
    preferredLongTrainingDays: listaDeDias,
  })
  .transform((p): PerfilGarmin => ({
    fonte: FONTE,
    sistemaDeMedidas: p.measurementSystem,
    fusoHorario: p.timeZone,
    diasDisponiveis: p.availableTrainingDays,
    diasLongos: p.preferredLongTrainingDays,
  }));

const sensorSchema = z.object({
  sourceType: texto,
  antplusDeviceType: texto,
  bleDeviceType: texto,
  localDeviceType: texto,
});

/**
 * Detalhe da atividade: só interessa a lista de sensores, para saber se a FC veio de uma cinta
 * (sensor externo de FC por ANT+ ou Bluetooth) ou do pulso (sensor local `WHR`). Sem informação,
 * `desconhecido`: não se deduz que "sem cinta" quer dizer "pulso".
 */
export const detalheDaAtividadeSchema = z
  .object({
    metadataDTO: z.object({ sensors: z.array(sensorSchema).max(100).nullish() }).nullish(),
  })
  .transform((d): OrigemDeFc => {
    const sensores = d.metadataDTO?.sensors ?? [];
    const ehFc = (valor: string | null) => valor?.toUpperCase() === "HEART_RATE";
    if (sensores.some((s) => ehFc(s.antplusDeviceType) || ehFc(s.bleDeviceType))) return "cinta";
    if (sensores.some((s) => s.localDeviceType?.toUpperCase() === "WHR")) return "pulso";
    return "desconhecido";
  });

/**
 * Resposta da troca da chave por token. O formato NÃO está na documentação pública da Garmin
 * (só a chamada); aceitamos os nomes mais comuns e deixamos o erro claro se vier outro formato.
 * Ver a pesquisa em docs/pesquisa/garmin-limites-api-2026-11.md.
 */
export const tokenSchema = z
  .union([
    z.object({
      access_token: z.string().min(1),
      expires_in: z.number().positive().nullish(),
    }),
    z.object({
      accessToken: z.string().min(1),
      expiresIn: z.number().positive().nullish(),
    }),
  ])
  .transform((t) =>
    "access_token" in t
      ? { token: t.access_token, expiraEmSegundos: t.expires_in ?? null }
      : { token: t.accessToken, expiraEmSegundos: t.expiresIn ?? null },
  );
