/**
 * Tipos que seguram a chave e o token da Garmin e se recusam a sair do programa por acidente.
 *
 * O valor fica num campo privado de verdade (`#valor`): não aparece em `Object.keys`, em
 * `JSON.stringify`, em `structuredClone` nem em console, e `toString`, `toJSON`, a conversão para
 * texto e a inspeção do Node devolvem `[REDACTED]`. A única saída do valor é o método que monta o
 * cabeçalho HTTP, e quem o chama é o cliente deste pacote.
 */

export const REDACTED = "[REDACTED]";

/** Símbolo que o `util.inspect` do Node usa; `Symbol.for` evita importar `node:util` na Worker. */
const INSPECIONAR = Symbol.for("nodejs.util.inspect.custom");

abstract class Segredo {
  toString(): string {
    return REDACTED;
  }
  toJSON(): string {
    return REDACTED;
  }
  [Symbol.toPrimitive](): string {
    return REDACTED;
  }
  [INSPECIONAR](): string {
    return REDACTED;
  }
}

/** Tamanho máximo aceito. A Garmin não documenta o formato; isto só barra lixo e colagem errada. */
const TAMANHO_MAXIMO = 2048;

export class ChaveMalFormadaError extends Error {
  constructor(motivo: string) {
    // A mensagem nunca cita o valor recebido, só o motivo.
    super(`A chave da Garmin parece mal colada: ${motivo}.`);
    this.name = "ChaveMalFormadaError";
  }
}

/** A chave pessoal da Garmin (Personal API). Nasce do cofre de segredos e nunca sai deste tipo. */
export class GarminKey extends Segredo {
  readonly #valor: string;

  private constructor(valor: string) {
    super();
    this.#valor = valor;
  }

  /**
   * Cria a chave a partir do que veio do cofre. Recusa o que claramente não é uma chave
   * (vazio, espaço no meio, aspas coladas junto), para o erro aparecer como "chave mal colada" e
   * não como um 401 misterioso da Garmin.
   */
  static de(bruto: unknown): GarminKey {
    if (typeof bruto !== "string") throw new ChaveMalFormadaError("não é um texto");
    const valor = bruto.trim();
    if (valor === "") throw new ChaveMalFormadaError("está vazia");
    if (valor.length > TAMANHO_MAXIMO) throw new ChaveMalFormadaError("é grande demais");
    if (/["'`]/.test(valor)) {
      throw new ChaveMalFormadaError("tem aspas; cole só a chave, sem aspas");
    }
    if (/[\s\p{Cc}]/u.test(valor)) {
      throw new ChaveMalFormadaError("tem espaço ou quebra de linha no meio");
    }
    return new GarminKey(valor);
  }

  /** Cabeçalho `Authorization` da troca da chave por token (documentação da Garmin). */
  cabecalhoDaTroca(): string {
    return `ApiKey ${this.#valor}`;
  }
}

/** Token de acesso de 24 horas. Vive só na memória do processo; nunca vai para banco nem log. */
export class GarminToken extends Segredo {
  readonly #valor: string;
  /** Instante (ms desde 1970) a partir do qual o token não deve mais ser usado. */
  readonly expiraEm: number;

  constructor(valor: string, expiraEm: number) {
    super();
    this.#valor = valor;
    this.expiraEm = expiraEm;
  }

  /** Cabeçalho `Authorization` das chamadas de dados. */
  cabecalho(): string {
    return `Bearer ${this.#valor}`;
  }
}
