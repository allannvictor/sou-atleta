/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

/**
 * Banco D1 de mentira para os testes: um SQLite em memória com a mesma interface que a Worker
 * enxerga (`prepare`, `bind`, `run`, `all`, `first`, `raw` e `batch`). As migrações reais da
 * pasta `migrations/` são aplicadas, então os testes rodam contra as mesmas tabelas de produção.
 *
 * Só testes importam este arquivo. Ele conta as chamadas (`chamadas`), porque o plano gratuito
 * permite 50 subrequests por execução e os testes conferem que a sincronização cabe nisso.
 */

const PASTA_DE_MIGRACOES = new URL("../../migrations/", import.meta.url);

export interface D1EmMemoria {
  readonly d1: D1Database;
  /** Quantas idas ao banco já foram feitas (um `batch` conta como uma, como no D1 real). */
  chamadas(): number;
  /** Todas as linhas de todas as tabelas, em texto: serve para procurar o que não pode estar lá. */
  despejo(): string;
  /** Nomes das colunas de cada tabela. */
  colunas(): Record<string, string[]>;
  /** Roda SQL direto (só para montar cenários de teste). */
  executar(sql: string): void;
}

function aplicarMigracoes(banco: DatabaseSync): void {
  const arquivos = readdirSync(PASTA_DE_MIGRACOES)
    .filter((nome) => nome.endsWith(".sql"))
    .sort();
  for (const arquivo of arquivos) {
    const sql = readFileSync(new URL(arquivo, PASTA_DE_MIGRACOES), "utf8");
    for (const comando of sql.split("--> statement-breakpoint")) {
      if (comando.trim() !== "") banco.exec(comando);
    }
  }
}

function resultado(meta: { changes?: number | bigint; lastInsertRowid?: number | bigint }) {
  return {
    success: true as const,
    results: [] as never[],
    meta: {
      changes: Number(meta.changes ?? 0),
      last_row_id: Number(meta.lastInsertRowid ?? 0),
      duration: 0,
      rows_read: 0,
      rows_written: Number(meta.changes ?? 0),
    },
  };
}

export function criarD1EmMemoria(): D1EmMemoria {
  const banco = new DatabaseSync(":memory:");
  aplicarMigracoes(banco);
  let chamadas = 0;

  class Declaracao {
    constructor(
      readonly sql: string,
      readonly valores: SQLInputValue[] = [],
    ) {}

    bind(...valores: unknown[]): Declaracao {
      return new Declaracao(this.sql, valores as SQLInputValue[]);
    }

    executarRun() {
      return resultado(banco.prepare(this.sql).run(...this.valores));
    }

    executarAll() {
      const linhas = banco.prepare(this.sql).all(...this.valores) as Record<string, unknown>[];
      return { ...resultado({}), results: linhas.map((l) => ({ ...l })) };
    }

    executarRaw(): unknown[][] {
      const instrucao = banco.prepare(this.sql);
      instrucao.setReturnArrays(true);
      return instrucao.all(...this.valores) as unknown as unknown[][];
    }

    run() {
      chamadas += 1;
      return Promise.resolve(this.executarRun());
    }
    all() {
      chamadas += 1;
      return Promise.resolve(this.executarAll());
    }
    raw() {
      chamadas += 1;
      return Promise.resolve(this.executarRaw());
    }
    first(coluna?: string) {
      chamadas += 1;
      const linha = this.executarAll().results[0];
      if (linha === undefined) return Promise.resolve(null);
      return Promise.resolve(coluna === undefined ? linha : linha[coluna]);
    }
  }

  const d1 = {
    prepare: (sql: string) => new Declaracao(sql),
    batch: (declaracoes: Declaracao[]) => {
      chamadas += 1;
      // Como no D1 real, o lote inteiro é uma transação: ou grava tudo ou nada.
      banco.exec("BEGIN");
      try {
        const saidas = declaracoes.map((d) => {
          // Consultas devolvem linhas; escritas com RETURNING também.
          const instrucao = banco.prepare(d.sql);
          const linhas = instrucao.all(...d.valores) as Record<string, unknown>[];
          return { ...resultado({}), results: linhas.map((l) => ({ ...l })) };
        });
        banco.exec("COMMIT");
        return Promise.resolve(saidas);
      } catch (erro) {
        banco.exec("ROLLBACK");
        return Promise.reject(erro instanceof Error ? erro : new Error(String(erro)));
      }
    },
    exec: (sql: string) => {
      chamadas += 1;
      banco.exec(sql);
      return Promise.resolve({ count: 1, duration: 0 });
    },
  };

  const tabelas = (): string[] =>
    (
      banco
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[]
    ).map((l) => l.name);

  return {
    d1: d1 as unknown as D1Database,
    chamadas: () => chamadas,
    despejo: () =>
      tabelas()
        .map(
          (tabela) =>
            `${tabela}: ${JSON.stringify(banco.prepare(`SELECT * FROM ${tabela}`).all())}`,
        )
        .join("\n"),
    colunas: () =>
      Object.fromEntries(
        tabelas().map((tabela) => [
          tabela,
          (banco.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]).map(
            (c) => c.name,
          ),
        ]),
      ),
    executar: (sql) => {
      banco.exec(sql);
    },
  };
}
