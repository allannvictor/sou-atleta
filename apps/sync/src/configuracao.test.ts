import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ORCAMENTO, SUBREQUESTS_MAXIMOS } from "./limites.js";

/** Lê um `wrangler.jsonc` (comentários de linha inteira e vírgulas finais). */
function lerJsonc(caminho: URL): unknown {
  const texto = readFileSync(caminho, "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(texto);
}

const SYNC = new URL("../wrangler.jsonc", import.meta.url);
const WEB = new URL("../../web/wrangler.jsonc", import.meta.url);

const esquemaDoSync = z.object({
  name: z.string(),
  workers_dev: z.boolean(),
  preview_urls: z.boolean(),
  observability: z.object({
    enabled: z.boolean(),
    logs: z.object({ enabled: z.boolean(), invocation_logs: z.boolean() }),
    traces: z.object({ enabled: z.boolean() }),
  }),
  d1_databases: z.array(
    z.object({ binding: z.string(), database_id: z.string(), migrations_dir: z.string() }),
  ),
});

describe("wrangler.jsonc da Worker sync", () => {
  const config = esquemaDoSync.parse(lerJsonc(SYNC));

  it("não tem endereço público: só a Worker do site chega, pela ligação interna", () => {
    expect(config.workers_dev).toBe(false);
    expect(config.preview_urls).toBe(false);
    expect(Object.keys(lerJsonc(SYNC) as object)).not.toContain("routes");
    expect(Object.keys(lerJsonc(SYNC) as object)).not.toContain("route");
  });

  it("não tem rotina agendada (decisão do dono, 16/11/2026): nenhum Cron Trigger", () => {
    const bruto = lerJsonc(SYNC) as Record<string, unknown>;
    expect(Object.keys(bruto)).not.toContain("triggers");
  });

  it("Workers Logs ligados aqui (decisão do dono), sem registros de invocação e sem tracing", () => {
    expect(config.observability.enabled).toBe(true);
    expect(config.observability.logs).toEqual({ enabled: true, invocation_logs: false });
    expect(config.observability.traces).toEqual({ enabled: false });
  });

  it("usa as migrações do pacote db e o D1 por um marcador, nunca por um id inventado", () => {
    const [banco] = config.d1_databases;
    expect(config.d1_databases).toHaveLength(1);
    expect(banco?.binding).toBe("DB");
    expect(banco?.migrations_dir).toBe("../../packages/db/migrations");
    // Ou o marcador (antes de o dono criar o banco) ou um UUID de verdade.
    expect(banco?.database_id).toMatch(
      /^(COLOQUE-AQUI-O-ID-DO-D1|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/,
    );
  });

  it("não traz nenhum valor de segredo no arquivo (a chave e a data entram por `wrangler secret put`)", () => {
    const texto = readFileSync(SYNC, "utf8");
    expect(texto).not.toMatch(/"vars"/);
    expect(texto).not.toMatch(/GARMIN_API_KEY["']?\s*:/);
    expect(texto).not.toMatch(/GARMIN_CHAVE_VENCE_EM["']?\s*:/);
  });
});

describe("Worker do site (apps/web)", () => {
  const texto = readFileSync(WEB, "utf8");

  it("continua com os logs desligados: só a Worker sync registra eventos", () => {
    expect(texto).toMatch(/"observability":\s*\{\s*"enabled":\s*false\s*\}/);
  });

  it("não recebe a chave da Garmin nem a data de vencimento", () => {
    const semComentarios = texto.replace(/^\s*\/\/.*$/gm, "");
    expect(semComentarios).not.toMatch(/GARMIN_API_KEY|GARMIN_CHAVE_VENCE_EM/);
  });
});

describe("ligação do site com o banco e com a sync", () => {
  const MARCADOR = "COLOQUE-AQUI-O-ID-DO-D1";
  const semComentarios = (texto: string) => texto.replace(/^\s*\/\/.*$/gm, "");
  const sync = readFileSync(SYNC, "utf8");
  const web = semComentarios(readFileSync(WEB, "utf8"));

  it("enquanto o D1 não existe (marcador), o site NÃO declara a ligação: o deploy do site não quebra", () => {
    if (!sync.includes(MARCADOR)) return;
    expect(web).not.toMatch(/d1_databases/);
    expect(web).not.toMatch(/"services"/);
  });

  it("depois que o dono liga, o site usa o mesmo id de banco e aponta para a Worker sync", () => {
    if (sync.includes(MARCADOR)) return;
    const idDoSync = /"database_id":\s*"([^"]+)"/.exec(semComentarios(sync))?.[1];
    expect(idDoSync).toMatch(/^[0-9a-f-]{36}$/);
    expect(web).toContain(`"database_id": "${idDoSync ?? ""}"`);
    expect(web).toMatch(/"binding":\s*"DB"/);
    expect(web).toMatch(/"binding":\s*"SYNC",\s*"service":\s*"sou-atleta-sync"/);
  });

  it("os blocos comentados do site usam o mesmo marcador e o nome certo da Worker", () => {
    const bruto = readFileSync(WEB, "utf8");
    if (sync.includes(MARCADOR)) {
      expect(bruto).toContain(`"database_id": "${MARCADOR}"`);
      expect(bruto).toContain('"service": "sou-atleta-sync"');
    }
    expect(esquemaDoSync.parse(lerJsonc(SYNC)).name).toBe("sou-atleta-sync");
  });
});

describe("orçamento do plano gratuito", () => {
  it("cabe nos 50 subrequests por execução, com folga", () => {
    expect(SUBREQUESTS_MAXIMOS).toBeLessThanOrEqual(40);
    for (const modo of Object.values(ORCAMENTO)) {
      expect(modo.garmin).toBeLessThan(SUBREQUESTS_MAXIMOS);
      expect(modo.janelas).toBeGreaterThanOrEqual(1);
    }
    // O botão espera a resposta: pausa de 1,5 s entre requisições, no máximo 8, ou seja, cerca
    // de 12 s; ao abrir a página o trabalho segue em segundo plano (até 30 s).
    for (const modo of Object.values(ORCAMENTO)) expect(modo.garmin * 1.5).toBeLessThan(30);
  });
});
