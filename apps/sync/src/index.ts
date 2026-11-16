import { criarBanco } from "@sou-atleta/db";
import {
  ChaveMalFormadaError,
  criarCacheDeToken,
  criarClienteGarmin,
  ehData,
  GarminKey,
} from "@sou-atleta/garmin";

import { registrarNoConsole } from "./log.js";
import {
  prepararExecucao,
  sincronizar,
  type ChaveDoCofre,
  type Dependencias,
} from "./sincronizar.js";

/**
 * Worker de sincronização com a Garmin (issue #5). Duas portas:
 *
 * - `scheduled`: o Cron Trigger (a cada 15 minutos, ver wrangler.jsonc);
 * - `fetch`: `POST /atualizar`, o botão "Atualizar agora". Esta Worker NÃO tem endereço público
 *   (`workers_dev` e `preview_urls` desligados, sem rotas): só a Worker do site chega aqui, pela
 *   ligação interna `SYNC`, e só depois de o Cloudflare Access e a validação do JWT liberarem
 *   `/app`. A chave da Garmin existe só dentro desta Worker.
 */

/** Token da Garmin guardado só na memória deste processo, para não trocar a chave a cada 15 min. */
const cacheDeToken = criarCacheDeToken();

function lerChave(env: Env): ChaveDoCofre {
  if (env.GARMIN_API_KEY === undefined || env.GARMIN_API_KEY.trim() === "") {
    return { tipo: "ausente" };
  }
  try {
    return {
      tipo: "ok",
      cliente: criarClienteGarmin({ chave: GarminKey.de(env.GARMIN_API_KEY), cacheDeToken }),
    };
  } catch (erro) {
    if (erro instanceof ChaveMalFormadaError) return { tipo: "mal_formada" };
    throw erro;
  }
}

function dependencias(env: Env): Dependencias {
  const vence = env.GARMIN_CHAVE_VENCE_EM?.trim();
  return {
    banco: criarBanco(env.DB),
    chave: lerChave(env),
    venceEm: vence !== undefined && ehData(vence) ? vence : null,
    agora: () => new Date(),
    registrar: registrarNoConsole,
  };
}

const falhaSemDetalhe = () => {
  registrarNoConsole({ evento: "erro_interno" });
};

export default {
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(
      sincronizar(dependencias(env), "agendada").then(() => undefined, falhaSemDetalhe),
    );
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method !== "POST" || pathname !== "/atualizar") {
      return new Response(null, { status: 404 });
    }
    try {
      const preparacao = await prepararExecucao(dependencias(env), "manual");
      if (preparacao.tipo === "ignorada") {
        return Response.json({ resultado: preparacao.motivo });
      }
      // Responde já; o trabalho continua em segundo plano (até 30 s depois da resposta).
      ctx.waitUntil(preparacao.executar().then(() => undefined, falhaSemDetalhe));
      return Response.json({ resultado: "iniciada" }, { status: 202 });
    } catch {
      falhaSemDetalhe();
      return Response.json({ resultado: "erro" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
