import { sql } from "drizzle-orm";
import { check, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Esquema do banco (D1). Regras que valem para todas as tabelas (issue #5, decisões 0002 e 0007):
 *
 * - **Minimização.** Só entra o que as métricas da decisão 0003 usam. Não existe coluna para
 *   trajeto, latitude, longitude, nome do local, nome da pessoa, e-mail, foto nem para a chave ou
 *   o token da Garmin. Um teste confere os nomes das colunas.
 * - **Fonte.** Todo registro diz de onde veio (`fonte`); o CHECK impede qualquer outro valor.
 * - **Idempotência.** Cada linha tem chave natural (id da atividade, data do dia): gravar duas
 *   vezes a mesma coisa não duplica nada.
 * - Datas de calendário em texto `YYYY-MM-DD`; instantes em texto ISO 8601 (UTC).
 */

export const FONTES = ["garmin"] as const;
export type Fonte = (typeof FONTES)[number];

/** De onde veio a frequência cardíaca: sensor do pulso, cinta no peito ou a Garmin não disse. */
export const ORIGENS_DE_FC = ["pulso", "cinta", "desconhecido"] as const;
export type OrigemDeFc = (typeof ORIGENS_DE_FC)[number];

/** Os quatro fluxos de dados que a sincronização importa por janelas de datas. */
export const FLUXOS = ["atividades", "resumo_diario", "sono", "hrv"] as const;
export type Fluxo = (typeof FLUXOS)[number];

export const STATUS_DA_CHAVE = [
  "nao_verificada",
  "ausente",
  "mal_formada",
  "ok",
  "invalida",
] as const;
export type StatusDaChave = (typeof STATUS_DA_CHAVE)[number];

const lista = (valores: readonly string[]) => sql.raw(valores.map((v) => `'${v}'`).join(", "));

export const atividade = sqliteTable(
  "atividade",
  {
    /** `activityId` da Garmin: é o que evita duplicar a atividade numa nova importação. */
    id: integer("id").primaryKey(),
    fonte: text("fonte", { enum: FONTES }).notNull(),
    /** Dia em que a atividade começou, na hora local do atleta. */
    dataLocal: text("data_local").notNull(),
    inicioLocal: text("inicio_local").notNull(),
    inicioGmt: text("inicio_gmt").notNull(),
    tipo: text("tipo").notNull(),
    duracaoS: real("duracao_s").notNull(),
    distanciaM: real("distancia_m"),
    fcMedia: real("fc_media"),
    fcMaxima: real("fc_maxima"),
    /** Pulso ou cinta. `desconhecido` até a Garmin dizer (decisão 0003: selo de confiança). */
    fcOrigem: text("fc_origem", { enum: ORIGENS_DE_FC }).notNull().default("desconhecido"),
    /** 0 enquanto a origem da FC ainda não foi consultada na Garmin. */
    fcOrigemConferida: integer("fc_origem_conferida", { mode: "boolean" }).notNull().default(false),
    tempoZona1S: real("tempo_zona1_s"),
    tempoZona2S: real("tempo_zona2_s"),
    tempoZona3S: real("tempo_zona3_s"),
    tempoZona4S: real("tempo_zona4_s"),
    tempoZona5S: real("tempo_zona5_s"),
    vo2max: real("vo2max"),
    efeitoAerobico: real("efeito_aerobico"),
    efeitoAnaerobico: real("efeito_anaerobico"),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (t) => [
    check("atividade_fonte", sql`${t.fonte} IN (${lista(FONTES)})`),
    check("atividade_fc_origem", sql`${t.fcOrigem} IN (${lista(ORIGENS_DE_FC)})`),
  ],
);

export const diaHrv = sqliteTable(
  "dia_hrv",
  {
    data: text("data").primaryKey(),
    fonte: text("fonte", { enum: FONTES }).notNull(),
    hrvNoiteMs: real("hrv_noite_ms"),
    hrvSemanaMs: real("hrv_semana_ms"),
    hrvPico5minMs: real("hrv_pico_5min_ms"),
    estado: text("estado"),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (t) => [check("dia_hrv_fonte", sql`${t.fonte} IN (${lista(FONTES)})`)],
);

export const diaSono = sqliteTable(
  "dia_sono",
  {
    data: text("data").primaryKey(),
    fonte: text("fonte", { enum: FONTES }).notNull(),
    sonoS: integer("sono_s"),
    profundoS: integer("profundo_s"),
    leveS: integer("leve_s"),
    remS: integer("rem_s"),
    acordadoS: integer("acordado_s"),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (t) => [check("dia_sono_fonte", sql`${t.fonte} IN (${lista(FONTES)})`)],
);

export const diaResumo = sqliteTable(
  "dia_resumo",
  {
    data: text("data").primaryKey(),
    fonte: text("fonte", { enum: FONTES }).notNull(),
    fcRepouso: integer("fc_repouso"),
    /** A Garmin não diz qual sensor mediu a FC de repouso do dia. */
    fcRepousoOrigem: text("fc_repouso_origem", { enum: ORIGENS_DE_FC })
      .notNull()
      .default("desconhecido"),
    estresseMedio: integer("estresse_medio"),
    estresseMaximo: integer("estresse_maximo"),
    bodyBatteryMin: integer("body_battery_min"),
    bodyBatteryMax: integer("body_battery_max"),
    bodyBatteryCarregada: integer("body_battery_carregada"),
    bodyBatteryDrenada: integer("body_battery_drenada"),
    bodyBatteryFimDoDia: integer("body_battery_fim_do_dia"),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (t) => [
    check("dia_resumo_fonte", sql`${t.fonte} IN (${lista(FONTES)})`),
    check("dia_resumo_fc_origem", sql`${t.fcRepousoOrigem} IN (${lista(ORIGENS_DE_FC)})`),
  ],
);

export const zonaFc = sqliteTable(
  "zona_fc",
  {
    /** Esporte a que as zonas se aplicam (como a Garmin chama), ou `DEFAULT`. */
    esporte: text("esporte").primaryKey(),
    fonte: text("fonte", { enum: FONTES }).notNull(),
    metodo: text("metodo"),
    fcMaxima: integer("fc_maxima"),
    fcRepouso: integer("fc_repouso"),
    fcLimiar: integer("fc_limiar"),
    zona1Piso: integer("zona1_piso").notNull(),
    zona2Piso: integer("zona2_piso").notNull(),
    zona3Piso: integer("zona3_piso").notNull(),
    zona4Piso: integer("zona4_piso").notNull(),
    zona5Piso: integer("zona5_piso").notNull(),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (t) => [check("zona_fc_fonte", sql`${t.fonte} IN (${lista(FONTES)})`)],
);

export const perfilTreino = sqliteTable(
  "perfil_treino",
  {
    id: integer("id").primaryKey(),
    fonte: text("fonte", { enum: FONTES }).notNull(),
    sistemaDeMedidas: text("sistema_de_medidas"),
    fusoHorario: text("fuso_horario"),
    /** Lista JSON de dias da semana em que o atleta pode treinar. */
    diasDisponiveis: text("dias_disponiveis"),
    /** Lista JSON de dias da semana preferidos para treinos longos. */
    diasLongos: text("dias_longos"),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (t) => [
    check("perfil_treino_unico", sql`${t.id} = 1`),
    check("perfil_treino_fonte", sql`${t.fonte} IN (${lista(FONTES)})`),
  ],
);

/** Até onde cada fluxo já foi importado. A importação retoma daqui. */
export const progressoImportacao = sqliteTable(
  "progresso_importacao",
  {
    fluxo: text("fluxo", { enum: FLUXOS }).primaryKey(),
    /** Primeiro dia do histórico a importar. */
    inicio: text("inicio").notNull(),
    /** Último dia já importado por completo; vazio antes da primeira janela. */
    importadoAte: text("importado_ate"),
    /** Verdadeiro quando a importação do histórico chegou ao dia de hoje. */
    historicoCompleto: integer("historico_completo", { mode: "boolean" }).notNull().default(false),
    verificadoEm: text("verificado_em"),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (t) => [check("progresso_fluxo", sql`${t.fluxo} IN (${lista(FLUXOS)})`)],
);

/** Uma linha só: o que o atleta precisa saber sobre a sincronização. Nunca guarda a chave. */
export const sincronizacaoEstado = sqliteTable(
  "sincronizacao_estado",
  {
    id: integer("id").primaryKey(),
    statusDaChave: text("status_da_chave", { enum: STATUS_DA_CHAVE })
      .notNull()
      .default("nao_verificada"),
    /** Data de vencimento informada pelo dono ao cadastrar a chave (`YYYY-MM-DD`). */
    chaveVenceEm: text("chave_vence_em"),
    /** Código curto do último problema (nunca texto livre): ver `CODIGOS_DE_ERRO`. */
    erroCodigo: text("erro_codigo"),
    ultimaExecucaoEm: text("ultima_execucao_em"),
    ultimoSucessoEm: text("ultimo_sucesso_em"),
    /** Antes deste instante a sincronização não fala com a Garmin. */
    pausaAte: text("pausa_ate"),
    falhasDeLimiteSeguidas: integer("falhas_de_limite_seguidas").notNull().default(0),
    /** Trava contra duas execuções ao mesmo tempo; expira sozinha. */
    travaAte: text("trava_ate"),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (t) => [
    check("sincronizacao_estado_unico", sql`${t.id} = 1`),
    check("sincronizacao_estado_status", sql`${t.statusDaChave} IN (${lista(STATUS_DA_CHAVE)})`),
  ],
);

export const CODIGOS_DE_ERRO = [
  "chave_invalida",
  "limite_garmin",
  "garmin_indisponivel",
  "rede",
  "formato_inesperado",
  "acesso_negado",
  "execucao_interrompida",
  "erro_interno",
  "token_recusado",
] as const;
export type CodigoDeErro = (typeof CODIGOS_DE_ERRO)[number];
