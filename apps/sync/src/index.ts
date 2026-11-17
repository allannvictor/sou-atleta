import {
  apagarTudo,
  criarBanco,
  NOMES_DAS_TABELAS,
  sincronizacaoEmAndamento,
  type ResultadoDaAtualizacao,
  type ResultadoDoApagar,
} from "@sou-atleta/db";
import {
  ChaveMalFormadaError,
  criarCacheDeToken,
  criarClienteGarmin,
  ehData,
  GarminKey,
} from "@sou-atleta/garmin";

import type { Modo } from "./limites.js";
import { registrarNoConsole } from "./log.js";
import {
  prepararExecucao,
  resultadoParaOSite,
  type ChaveDoCofre,
  type Dependencias,
} from "./sincronizar.js";

/**
 * Worker de sincronização com a Garmin (issue #5). Não há rotina agendada (decisão do dono,
 * 16/11/2026): ela roda quando o site pede, por duas portas:
 *
 * - `POST /ao-abrir`: o dono abriu a área fechada. Responde na hora e trabalha em segundo plano;
 *   o site nem espera. No máximo uma execução a cada 10 minutos.
 * - `POST /atualizar`: o botão "Atualizar agora". Espera o fim e responde o que aconteceu (não
 *   diz "iniciada" quando a Garmin recusou a chave).
 * - `POST /apagar-tudo`: "Apagar minha conta" (issue #22). Só apaga com a chave da Garmin já
 *   removida do cofre; senão a próxima abertura da página reimportaria tudo.
 *
 * Esta Worker NÃO tem endereço público (`workers_dev` e `preview_urls` desligados, sem rotas):
 * só a Worker do site chega aqui, pela ligação interna `SYNC`, e só depois de o Cloudflare Access
 * e a validação do JWT liberarem `/app`. A chave da Garmin existe só dentro desta Worker. Nunca
 * adicione rota ou domínio a ela.
 */

/** Token da Garmin guardado só na memória deste processo, para não trocar a chave a cada pedido. */
const cacheDeToken = criarCacheDeToken();

function lerChave(env: Env): ChaveDoCofre {
  if (env.GARMIN_API_KEY === undefined || env.GARMIN_API_KEY.trim() === "") {
    return { tipo: "ausente" };
  }
  try {
    return {
      tipo: "ok",
      cliente: criarClienteGarmin({
        chave: GarminKey.de(env.GARMIN_API_KEY),
        cacheDeToken,
        // Item inválido é descartado e contado: só a quantidade vai para o log.
        aoDescartar: (fluxo, quantidade) => {
          registrarNoConsole({ evento: "itens_descartados", fluxo, quantidade });
        },
      }),
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
    liberada: env.POLITICA_REVISTA === "sim",
    chave: lerChave(env),
    venceEm: vence !== undefined && ehData(vence) ? vence : null,
    agora: () => new Date(),
    registrar: registrarNoConsole,
  };
}

/** Mesma regra de `lerChave`: segredo vazio conta como ausente. */
const chaveNoCofre = (env: Env) =>
  env.GARMIN_API_KEY !== undefined && env.GARMIN_API_KEY.trim() !== "";

/**
 * Apaga tudo o que o app guardou. Só roda com a chave ausente: o app não consegue apagar o
 * segredo (isso exigiria um token da Cloudflare com poder sobre segredos), então o dono o
 * remove antes, pelo passo a passo da tela "Sua conta". Sem chave, a sincronização não busca nada.
 */
async function apagarTudoDoApp(env: Env): Promise<ResultadoDoApagar> {
  if (chaveNoCofre(env)) {
    registrarNoConsole({ evento: "apagar_recusado_chave_presente" });
    return "chave_presente";
  }
  const banco = criarBanco(env.DB);
  // Uma execução ainda viva (por exemplo, de uma versão antiga da Worker que ainda tinha a chave)
  // gravaria dados de volta depois do apagar: espera a trava de 5 minutos passar.
  if (await sincronizacaoEmAndamento(banco, new Date().toISOString())) {
    registrarNoConsole({ evento: "apagar_recusado_sincronizando" });
    return "sincronizacao_em_andamento";
  }
  await apagarTudo(banco);
  registrarNoConsole({ evento: "dados_apagados", tabelas: NOMES_DAS_TABELAS.length });
  return "apagado";
}

const falhaSemDetalhe = () => {
  registrarNoConsole({ evento: "erro_interno" });
};

const responder = (resultado: ResultadoDaAtualizacao, status = 200) =>
  Response.json({ resultado }, { status });

/** Prepara a execução; devolve o que responder ou o trabalho a fazer. */
async function iniciar(env: Env, modo: Modo) {
  // Dentro do try de quem chama: se montar as dependências lançar, a exceção não escapa.
  const preparacao = await prepararExecucao(dependencias(env), modo);
  if (preparacao.tipo === "ignorada") {
    return {
      resposta: responder(resultadoParaOSite({ ...SEM_TRABALHO, resultado: preparacao.motivo })),
    };
  }
  return { executar: preparacao.executar };
}

const SEM_TRABALHO = {
  janelas: 0,
  requisicoesGarmin: 0,
  subrequests: 0,
  buscouDados: false,
  erroCodigo: null,
} as const;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/apagar-tudo") {
      try {
        return Response.json({ resultado: await apagarTudoDoApp(env) });
      } catch {
        falhaSemDetalhe();
        return Response.json({ resultado: "erro" satisfies ResultadoDoApagar }, { status: 500 });
      }
    }
    if (request.method !== "POST" || (pathname !== "/atualizar" && pathname !== "/ao-abrir")) {
      return new Response(null, { status: 404 });
    }
    const manual = pathname === "/atualizar";
    try {
      const inicio = await iniciar(env, manual ? "manual" : "ao_abrir");
      if ("resposta" in inicio) return inicio.resposta;
      if (manual) {
        // O botão espera e conta o que de fato aconteceu. A execução também fica sob
        // `waitUntil`: se a conexão cair no meio, ela termina e solta a trava em vez de ser
        // cancelada e deixar a trava presa por 5 minutos.
        const execucao = inicio.executar();
        ctx.waitUntil(execucao.then(() => undefined, falhaSemDetalhe));
        return responder(resultadoParaOSite(await execucao));
      }
      // Ao abrir a página, ninguém espera: responde na hora e continua em segundo plano.
      ctx.waitUntil(inicio.executar().then(() => undefined, falhaSemDetalhe));
      return responder("iniciada", 202);
    } catch {
      falhaSemDetalhe();
      return responder("erro", 500);
    }
  },
} satisfies ExportedHandler<Env>;
