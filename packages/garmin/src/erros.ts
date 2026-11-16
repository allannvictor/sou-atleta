/**
 * Erros do conector. Regra: a mensagem é montada só com texto fixo e nomes de campos, nunca com
 * valores recebidos da Garmin nem com a chave, o token ou cabeçalhos. Assim nenhum log nem tela
 * que mostre `erro.message` pode vazar segredo ou dado de saúde.
 */

export abstract class ErroDaGarmin extends Error {
  abstract readonly codigo: string;
}

/** A Garmin recusou a chave (expirada, revogada ou errada). A sincronização para até haver outra. */
export class ChaveInvalidaError extends ErroDaGarmin {
  readonly codigo = "chave_invalida";
  constructor() {
    super("A Garmin não aceitou a chave: ela expirou, foi revogada ou está errada.");
    this.name = "ChaveInvalidaError";
  }
}

/** A Garmin pediu para esperar (HTTP 429). Quem chama deve parar e tentar só depois. */
export class LimiteExcedidoError extends ErroDaGarmin {
  readonly codigo = "limite_garmin";
  constructor(readonly esperarSegundos: number) {
    super(
      `A Garmin pediu para esperar ${String(esperarSegundos)} segundos antes de nova tentativa.`,
    );
    this.name = "LimiteExcedidoError";
  }
}

/** A Garmin respondeu 5xx. */
export class GarminIndisponivelError extends ErroDaGarmin {
  readonly codigo = "garmin_indisponivel";
  constructor(readonly status: number) {
    super(`A Garmin respondeu com erro do servidor (${String(status)}).`);
    this.name = "GarminIndisponivelError";
  }
}

/** Falha de rede antes de a Garmin responder. */
export class RedeGarminError extends ErroDaGarmin {
  readonly codigo = "rede";
  constructor() {
    super("Não foi possível falar com a Garmin (falha de rede).");
    this.name = "RedeGarminError";
  }
}

/** A resposta não tem o formato esperado. Nunca se inventa dado: a sincronização desse fluxo para. */
export class RespostaInesperadaError extends ErroDaGarmin {
  readonly codigo = "formato_inesperado";
  constructor(
    readonly endpoint: string,
    /** Caminhos dos campos com problema (só nomes), por exemplo `[0].startTimeLocal`. */
    readonly campos: readonly string[],
  ) {
    super(
      `A resposta da Garmin em ${endpoint} não tem o formato esperado (campos: ${campos.join(", ") || "resposta inteira"}).`,
    );
    this.name = "RespostaInesperadaError";
  }
}

/** A Garmin negou o acesso a um endpoint específico (403), sem a chave estar inválida. */
export class AcessoNegadoError extends ErroDaGarmin {
  readonly codigo = "acesso_negado";
  constructor(readonly endpoint: string) {
    super(`A Garmin negou o acesso a ${endpoint}.`);
    this.name = "AcessoNegadoError";
  }
}

/** A Garmin recusou o pedido (4xx que não é 401, 403 nem 429). */
export class PedidoRecusadoError extends ErroDaGarmin {
  readonly codigo = "formato_inesperado";
  constructor(
    readonly endpoint: string,
    readonly status: number,
  ) {
    super(`A Garmin recusou o pedido a ${endpoint} (${String(status)}).`);
    this.name = "PedidoRecusadoError";
  }
}
