import { z } from "zod";

/**
 * Registro de eventos da sincronização (Workers Logs, só nesta Worker: decisão do dono em
 * 15/11/2026, ver docs/decisoes/0005-arquitetura.md).
 *
 * Regra: o log leva só EVENTOS (o que aconteceu) com campos de uma lista fechada: nomes de
 * fluxo, códigos e contagens. Nunca a chave, o token, cabeçalhos, URLs, mensagens de erro de
 * terceiros nem qualquer dado de saúde ou de atividade. Duas travas:
 *
 * 1. o tipo `EventoDeLog` só permite esses campos;
 * 2. mesmo que alguém force um tipo errado, `registrar` valida o evento com Zod estrito e, se
 *    não bater, grava só `{ "evento": "log_invalido" }`.
 *
 * Este é o único arquivo do repositório autorizado a usar `console` (exceção no
 * `eslint.config.js`).
 */

const FLUXOS = ["atividades", "resumo_diario", "sono", "hrv"] as const;
const ONDE = [...FLUXOS, "perfil", "zonas", "detalhe_da_atividade", "token"] as const;
const MODOS = ["ao_abrir", "manual"] as const;
const RESULTADOS = [
  "concluida",
  "parada_por_erro",
  "pausada",
  "sem_chave",
  "ja_em_andamento",
  "muito_cedo",
  "nao_liberada",
] as const;

const contagem = z.number().int().nonnegative();
const campo = z.string().regex(/^[A-Za-z0-9_.]{1,80}$/);

const esquemaDoEvento = z.discriminatedUnion("evento", [
  z.strictObject({ evento: z.literal("execucao_iniciada"), modo: z.enum(MODOS) }),
  z.strictObject({
    evento: z.literal("execucao_concluida"),
    modo: z.enum(MODOS),
    resultado: z.enum(RESULTADOS),
    janelas: contagem,
    requisicoesGarmin: contagem,
    subrequests: contagem,
    buscouDados: z.boolean(),
  }),
  z.strictObject({
    evento: z.literal("execucao_ignorada"),
    modo: z.enum(MODOS),
    motivo: z.enum(["pausada", "muito_cedo", "ja_em_andamento", "sem_chave", "nao_liberada"]),
  }),
  z.strictObject({ evento: z.literal("execucao_anterior_interrompida") }),
  z.strictObject({
    evento: z.literal("janela_importada"),
    fluxo: z.enum(FLUXOS),
    itens: contagem,
    importacaoInicialCompleta: z.boolean(),
  }),
  z.strictObject({ evento: z.literal("importacao_inicial_iniciada") }),
  z.strictObject({
    evento: z.literal("itens_descartados"),
    fluxo: z.enum(FLUXOS),
    quantidade: contagem,
  }),
  z.strictObject({ evento: z.literal("perfil_atualizado") }),
  z.strictObject({ evento: z.literal("origem_de_fc_conferida"), atividades: contagem }),
  z.strictObject({ evento: z.literal("orcamento_esgotado") }),
  z.strictObject({ evento: z.literal("limite_garmin"), esperarSegundos: contagem }),
  z.strictObject({ evento: z.literal("chave_invalida") }),
  z.strictObject({ evento: z.literal("token_recusado") }),
  z.strictObject({ evento: z.literal("chave_ausente") }),
  z.strictObject({ evento: z.literal("chave_mal_formada") }),
  z.strictObject({
    evento: z.literal("formato_inesperado"),
    onde: z.enum(ONDE),
    campos: z.array(campo).max(5),
  }),
  z.strictObject({ evento: z.literal("acesso_negado"), onde: z.enum(ONDE) }),
  z.strictObject({ evento: z.literal("garmin_indisponivel"), status: z.number().int() }),
  z.strictObject({ evento: z.literal("erro_de_rede") }),
  z.strictObject({ evento: z.literal("erro_interno") }),
]);

export type EventoDeLog = z.input<typeof esquemaDoEvento>;
export type Registrador = (evento: EventoDeLog) => void;
export type OndeFalhou = (typeof ONDE)[number];

/** Saída de verdade: uma linha JSON por evento, que o Workers Logs indexa por campo. */
export const registrarNoConsole: Registrador = (evento) => {
  const valido = esquemaDoEvento.safeParse(evento);
  console.log(JSON.stringify(valido.success ? valido.data : { evento: "log_invalido" }));
};
