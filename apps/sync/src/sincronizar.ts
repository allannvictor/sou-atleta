import {
  avancarProgresso,
  executarLote,
  FLUXOS,
  gravarAtividade,
  gravarDiaHrv,
  gravarDiaResumo,
  gravarDiaSono,
  gravarOrigemDeFc,
  gravarPerfil,
  gravarZonaFc,
  hojeNoFuso,
  iniciarProgresso,
  lerFotoGarantindoEstado,
  listarAtividadesSemOrigemDeFc,
  registrarEstadoDaChave,
  registrarFimDaExecucao,
  tentarPegarTrava,
  type Banco,
  type CodigoDeErro,
  type ComandoDeLote,
  type FotoDaSincronizacao,
  type Fluxo,
  type ProgressoDoFluxo,
  type StatusDaChave,
} from "@sou-atleta/db";
import {
  AcessoNegadoError,
  ATIVIDADES_POR_PAGINA,
  ChaveInvalidaError,
  GarminIndisponivelError,
  JANELA_DIAS,
  LimiteExcedidoError,
  PedidoRecusadoError,
  RedeGarminError,
  RespostaInesperadaError,
  somarDias,
  type ClienteGarmin,
} from "@sou-atleta/garmin";

import {
  DATA_MINIMA,
  DIAS_DE_HISTORICO_SEM_ATIVIDADES,
  DIAS_DE_SAUDE_ANTES_DA_PRIMEIRA_ATIVIDADE,
  ESPERA_APOS_CHAVE_INVALIDA_SEGUNDOS,
  ESPERA_BASE_APOS_429_SEGUNDOS,
  ESPERA_MAXIMA_APOS_429_SEGUNDOS,
  INTERVALO_MINIMO_MANUAL_SEGUNDOS,
  ORCAMENTO,
  REVALIDAR_PERFIL_HORAS,
  REVERIFICACAO_MINUTOS,
  SOBREPOSICAO_DIAS,
  SUBREQUESTS_MAXIMOS,
  TRAVA_SEGUNDOS,
  type Modo,
} from "./limites.js";
import type { OndeFalhou, Registrador } from "./log.js";

/**
 * A sincronização com a Garmin (issue #5). Uma execução:
 *
 * 1. lê o estado, decide se roda (pausa por 429, intervalo do botão, outra execução em curso)
 *    e pega a trava;
 * 2. renova perfil e zonas de FC, no máximo uma vez por dia;
 * 3. importa janelas de datas de cada fluxo, uma por vez, em rodízio, até acabar o orçamento
 *    (`limites.ts`). Cada janela e o avanço do progresso entram no banco no MESMO lote: se algo
 *    interromper, a próxima execução retoma dali, sem duplicar nem pular dia;
 * 4. confere, com a sobra, se a FC das atividades veio de pulso ou de cinta;
 * 5. grava como terminou (códigos curtos, nunca texto de erro) e solta a trava.
 *
 * O que não couber fica para a próxima execução do cron.
 */

export type ChaveDoCofre =
  | { readonly tipo: "ok"; readonly cliente: ClienteGarmin }
  | { readonly tipo: "ausente" }
  | { readonly tipo: "mal_formada" };

export interface Dependencias {
  readonly banco: Banco;
  readonly chave: ChaveDoCofre;
  /** Vencimento da chave (`YYYY-MM-DD`) informado pelo dono, se válido. */
  readonly venceEm: string | null;
  readonly agora: () => Date;
  readonly registrar: Registrador;
}

export type Resultado =
  "concluida" | "parada_por_erro" | "pausada" | "sem_chave" | "ja_em_andamento" | "muito_cedo";

export interface ResumoDaExecucao {
  readonly resultado: Resultado;
  readonly janelas: number;
  readonly requisicoesGarmin: number;
  readonly subrequests: number;
}

export type Preparacao =
  | {
      readonly tipo: "ignorada";
      readonly motivo: Exclude<Resultado, "concluida" | "parada_por_erro">;
    }
  | { readonly tipo: "pronta"; readonly executar: () => Promise<ResumoDaExecucao> };

// ---------------------------------------------------------------------------------------------
// Regras de janela (puras, testadas à parte)
// ---------------------------------------------------------------------------------------------

/** O fluxo precisa de uma janela agora? */
export function deveProcessar(p: ProgressoDoFluxo, hoje: string, agoraMs: number): boolean {
  if (!p.historicoCompleto || p.importadoAte === null || p.importadoAte < hoje) return true;
  if (p.verificadoEm === null) return true;
  return agoraMs - Date.parse(p.verificadoEm) >= REVERIFICACAO_MINUTOS[p.fluxo] * 60_000;
}

export interface Janela {
  readonly de: string;
  readonly ate: string;
}

/**
 * Próxima janela a buscar. Durante a importação do histórico, segue do dia seguinte ao último
 * importado. Depois dela, volta `SOBREPOSICAO_DIAS` dias para pegar atividades editadas. Nunca
 * passa de hoje, nem excede o tamanho de janela do fluxo.
 */
export function proximaJanela(p: ProgressoDoFluxo, hoje: string): Janela {
  const volta = p.historicoCompleto ? 1 - SOBREPOSICAO_DIAS : 1;
  const comeco = p.importadoAte === null ? p.inicio : somarDias(p.importadoAte, volta);
  const de = comeco > hoje ? hoje : comeco;
  const ate = somarDias(de, JANELA_DIAS[p.fluxo] - 1);
  return { de, ate: ate > hoje ? hoje : ate };
}

// ---------------------------------------------------------------------------------------------
// Orçamento da execução
// ---------------------------------------------------------------------------------------------

class Orcamento {
  d1 = 0;
  constructor(
    private readonly limiteGarmin: number,
    private readonly cliente: ClienteGarmin | null,
  ) {}

  get garmin(): number {
    return this.cliente?.requisicoesFeitas() ?? 0;
  }
  get total(): number {
    return this.d1 + this.garmin;
  }
  /** Cabem mais `g` requisições à Garmin e `d` idas ao banco, guardando uma para o fim? */
  cabe(g: number, d: number): boolean {
    return this.garmin + g <= this.limiteGarmin && this.total + g + d + 1 <= SUBREQUESTS_MAXIMOS;
  }
}

class OrcamentoEsgotado extends Error {}

// ---------------------------------------------------------------------------------------------

const em = (data: Date, segundos: number) =>
  new Date(data.getTime() + segundos * 1000).toISOString();

function ondeFalhou(fluxo: Fluxo | "perfil" | "zonas" | "detalhe"): OndeFalhou {
  return fluxo === "detalhe" ? "detalhe_da_atividade" : fluxo;
}

/**
 * Primeira parte: decide se a execução roda e pega a trava. Fica separada de `executar` para o
 * botão "Atualizar agora" poder responder na hora ("iniciada" ou o motivo de não rodar) e deixar
 * o trabalho em segundo plano.
 */
export async function prepararExecucao(deps: Dependencias, modo: Modo): Promise<Preparacao> {
  const { banco, chave, registrar } = deps;
  const agora = deps.agora();
  const iso = agora.toISOString();
  const orcamento = new Orcamento(
    ORCAMENTO[modo].garmin,
    chave.tipo === "ok" ? chave.cliente : null,
  );

  const foto = await lerFotoGarantindoEstado(banco, iso);
  orcamento.d1 += 1;
  const estado = foto.estado;
  if (estado === null) return { tipo: "ignorada", motivo: "ja_em_andamento" };

  const ignorar = (motivo: Exclude<Resultado, "concluida" | "parada_por_erro">) => {
    registrar({ evento: "execucao_ignorada", modo, motivo });
    return { tipo: "ignorada", motivo } as const;
  };

  if (chave.tipo !== "ok") {
    const status: StatusDaChave = chave.tipo === "ausente" ? "ausente" : "mal_formada";
    registrar({ evento: chave.tipo === "ausente" ? "chave_ausente" : "chave_mal_formada" });
    if (estado.statusDaChave !== status || estado.chaveVenceEm !== deps.venceEm) {
      await registrarEstadoDaChave(
        banco,
        { statusDaChave: status, chaveVenceEm: deps.venceEm },
        iso,
      );
    }
    return ignorar("sem_chave");
  }

  // Pausa por 429 vale para o cron e para o botão. A pausa por chave recusada só segura o cron:
  // quem cadastrou outra chave aperta o botão para testar.
  if (
    estado.pausaAte !== null &&
    estado.pausaAte > iso &&
    (modo === "agendada" || estado.erroCodigo === "limite_garmin")
  ) {
    return ignorar("pausada");
  }
  if (
    modo === "manual" &&
    estado.ultimaExecucaoEm !== null &&
    agora.getTime() - Date.parse(estado.ultimaExecucaoEm) < INTERVALO_MINIMO_MANUAL_SEGUNDOS * 1000
  ) {
    return ignorar("muito_cedo");
  }

  const trava = await tentarPegarTrava(banco, iso, em(agora, TRAVA_SEGUNDOS));
  orcamento.d1 += 1;
  if (!trava.obtida) return ignorar("ja_em_andamento");
  if (trava.anteriorInterrompida) registrar({ evento: "execucao_anterior_interrompida" });

  return {
    tipo: "pronta",
    executar: () => executar(deps, modo, foto, orcamento, chave.cliente),
  };
}

/** Prepara e executa, para o cron. */
export async function sincronizar(deps: Dependencias, modo: Modo): Promise<ResumoDaExecucao> {
  const preparacao = await prepararExecucao(deps, modo);
  if (preparacao.tipo === "ignorada") {
    return { resultado: preparacao.motivo, janelas: 0, requisicoesGarmin: 0, subrequests: 1 };
  }
  return preparacao.executar();
}

interface Situacao {
  /** Status que já estava gravado (a chave só vira `ok` com uma resposta boa da Garmin). */
  statusAnterior: StatusDaChave;
  /** A Garmin recusou a chave nesta execução. */
  chaveRecusada: boolean;
  erroCodigo: CodigoDeErro | null;
  pausaAte: string | null;
  falhasDeLimite: number;
  /** Houve ao menos uma resposta boa da Garmin: a chave funciona. */
  garminRespondeu: boolean;
  parouPorErro: boolean;
}

async function executar(
  deps: Dependencias,
  modo: Modo,
  foto: FotoDaSincronizacao,
  orcamento: Orcamento,
  cliente: ClienteGarmin,
): Promise<ResumoDaExecucao> {
  const { banco, registrar } = deps;
  const agora = deps.agora();
  const iso = agora.toISOString();
  const limites = ORCAMENTO[modo];
  const estado = foto.estado;
  registrar({ evento: "execucao_iniciada", modo });

  const situacao: Situacao = {
    statusAnterior:
      estado === null ||
      estado.statusDaChave === "ausente" ||
      estado.statusDaChave === "mal_formada"
        ? "nao_verificada"
        : estado.statusDaChave,
    chaveRecusada: false,
    erroCodigo: null,
    pausaAte: null,
    falhasDeLimite: estado?.falhasDeLimiteSeguidas ?? 0,
    garminRespondeu: false,
    parouPorErro: false,
  };
  let janelas = 0;
  let erroDeFluxo: CodigoDeErro | null = null;

  /** Erros que só afetam um fluxo: registra e segue com os outros. */
  const fluxoFalhou = (erro: unknown, onde: Fluxo | "perfil" | "zonas" | "detalhe"): boolean => {
    if (erro instanceof RespostaInesperadaError || erro instanceof PedidoRecusadoError) {
      registrar({
        evento: "formato_inesperado",
        onde: ondeFalhou(onde),
        campos: erro instanceof RespostaInesperadaError ? [...erro.campos] : [],
      });
      erroDeFluxo ??= "formato_inesperado";
      return true;
    }
    if (erro instanceof AcessoNegadoError) {
      registrar({ evento: "acesso_negado", onde: ondeFalhou(onde) });
      erroDeFluxo ??= "acesso_negado";
      return true;
    }
    return false;
  };

  try {
    const progresso = new Map<Fluxo, ProgressoDoFluxo>(foto.progresso.map((p) => [p.fluxo, p]));
    let fuso = foto.perfil?.fusoHorario ?? null;

    // 1. Perfil e zonas de FC: mudam pouco, uma vez por dia basta.
    const perfilVencido =
      foto.perfil === null ||
      agora.getTime() - Date.parse(foto.perfil.atualizadoEm) >= REVALIDAR_PERFIL_HORAS * 3_600_000;
    if (perfilVencido && orcamento.cabe(3, 1)) {
      try {
        const perfil = await cliente.perfil();
        const zonas = await cliente.zonasDeFc();
        situacao.garminRespondeu = true;
        await executarLote(banco, [
          gravarPerfil(banco, perfil, iso),
          ...zonas.map((zona) => gravarZonaFc(banco, zona, iso)),
        ]);
        orcamento.d1 += 1;
        fuso = perfil.fusoHorario ?? fuso;
        registrar({ evento: "perfil_atualizado" });
      } catch (erro) {
        if (!fluxoFalhou(erro, "perfil")) throw erro;
      }
    }
    const hoje = hojeNoFuso(agora.getTime(), fuso);

    // 2. Onde começa o histórico, na primeira execução.
    if (FLUXOS.some((f) => !progresso.has(f))) {
      if (!orcamento.cabe(2, 1)) throw new OrcamentoEsgotado();
      const existente = [...progresso.values()][0];
      let inicioAtividades: string;
      let inicioSaude: string;
      if (existente === undefined) {
        const primeira = await cliente.primeiraAtividade();
        situacao.garminRespondeu = true;
        inicioAtividades =
          primeira?.dataLocal ?? somarDias(hoje, -DIAS_DE_HISTORICO_SEM_ATIVIDADES);
        inicioSaude =
          primeira === null
            ? inicioAtividades
            : somarDias(primeira.dataLocal, -DIAS_DE_SAUDE_ANTES_DA_PRIMEIRA_ATIVIDADE);
      } else {
        inicioAtividades = progresso.get("atividades")?.inicio ?? existente.inicio;
        inicioSaude = progresso.get("sono")?.inicio ?? existente.inicio;
      }
      const naoAntesDe = (data: string) => (data < DATA_MINIMA ? DATA_MINIMA : data);
      inicioAtividades = naoAntesDe(inicioAtividades);
      inicioSaude = naoAntesDe(inicioSaude);
      const faltando = FLUXOS.filter((f) => !progresso.has(f));
      await executarLote(banco, [
        ...iniciarProgresso(
          banco,
          faltando.filter((f) => f === "atividades"),
          inicioAtividades,
          iso,
        ),
        ...iniciarProgresso(
          banco,
          faltando.filter((f) => f !== "atividades"),
          inicioSaude,
          iso,
        ),
      ]);
      orcamento.d1 += 1;
      for (const fluxo of faltando) {
        progresso.set(fluxo, {
          fluxo,
          inicio: fluxo === "atividades" ? inicioAtividades : inicioSaude,
          importadoAte: null,
          historicoCompleto: false,
          verificadoEm: null,
        });
      }
      registrar({ evento: "historico_iniciado" });
    }

    // 3. Janelas, em rodízio entre os fluxos.
    const comProblema = new Set<Fluxo>();
    let acabouOrcamento = false;
    rodadas: while (janelas < limites.janelas) {
      let fezAlgo = false;
      for (const fluxo of FLUXOS) {
        if (janelas >= limites.janelas) break;
        const p = progresso.get(fluxo);
        if (p === undefined || comProblema.has(fluxo)) continue;
        if (!deveProcessar(p, hoje, agora.getTime())) continue;
        if (!orcamento.cabe(2, 1)) {
          acabouOrcamento = true;
          break rodadas;
        }
        try {
          const novo = await importarJanela(fluxo, p, hoje);
          progresso.set(fluxo, novo);
          janelas += 1;
          fezAlgo = true;
        } catch (erro) {
          if (erro instanceof OrcamentoEsgotado) {
            acabouOrcamento = true;
            break rodadas;
          }
          if (!fluxoFalhou(erro, fluxo)) throw erro;
          comProblema.add(fluxo);
        }
      }
      if (!fezAlgo) break;
    }
    if (acabouOrcamento) registrar({ evento: "orcamento_esgotado" });

    // 4. Com a sobra, confere se a FC veio do pulso ou de uma cinta.
    if (limites.conferenciasDeFc > 0 && orcamento.cabe(2, 2)) {
      try {
        const pendentes = await listarAtividadesSemOrigemDeFc(banco, limites.conferenciasDeFc);
        orcamento.d1 += 1;
        const comandos: ComandoDeLote[] = [];
        for (const id of pendentes) {
          if (!orcamento.cabe(2, 1)) break;
          const origem = await cliente.origemDeFc(id);
          situacao.garminRespondeu = true;
          comandos.push(gravarOrigemDeFc(banco, id, origem, iso));
        }
        if (comandos.length > 0) {
          await executarLote(banco, comandos);
          orcamento.d1 += 1;
          registrar({ evento: "origem_de_fc_conferida", atividades: comandos.length });
        }
      } catch (erro) {
        if (!fluxoFalhou(erro, "detalhe")) throw erro;
      }
    }

    // ---- Importa uma janela de um fluxo e avança o progresso, tudo no mesmo lote.
    async function importarJanela(
      fluxo: Fluxo,
      p: ProgressoDoFluxo,
      hojeLocal: string,
    ): Promise<ProgressoDoFluxo> {
      const janela = proximaJanela(p, hojeLocal);
      const comandos: ComandoDeLote[] = [];
      let itens = 0;

      if (fluxo === "atividades") {
        let inicio = 0;
        for (;;) {
          const pagina = await cliente.atividades({ ...janela, inicio });
          situacao.garminRespondeu = true;
          for (const a of pagina) comandos.push(gravarAtividade(banco, a, iso));
          itens += pagina.length;
          inicio += pagina.length;
          if (pagina.length < ATIVIDADES_POR_PAGINA) break;
          // Mais uma página: se não couber, abandona a janela inteira (nada foi gravado).
          if (!orcamento.cabe(1, 1)) throw new OrcamentoEsgotado();
        }
      } else if (fluxo === "resumo_diario") {
        const dias = await cliente.resumosDiarios(janela);
        for (const d of dias) comandos.push(gravarDiaResumo(banco, d, iso));
        itens = dias.length;
      } else if (fluxo === "sono") {
        const dias = await cliente.sono(janela);
        for (const d of dias) comandos.push(gravarDiaSono(banco, d, iso));
        itens = dias.length;
      } else {
        const dias = await cliente.hrv(janela);
        for (const d of dias) comandos.push(gravarDiaHrv(banco, d, iso));
        itens = dias.length;
      }
      situacao.garminRespondeu = true;

      const historicoCompleto = p.historicoCompleto || janela.ate >= hojeLocal;
      comandos.push(
        avancarProgresso(banco, { fluxo, importadoAte: janela.ate, historicoCompleto }, iso),
      );
      await executarLote(banco, comandos);
      orcamento.d1 += 1;
      registrar({ evento: "janela_importada", fluxo, itens, historicoCompleto });
      return { ...p, importadoAte: janela.ate, historicoCompleto, verificadoEm: iso };
    }
  } catch (erro) {
    tratarErroFatal(erro);
  }

  function tratarErroFatal(erro: unknown): void {
    if (erro instanceof OrcamentoEsgotado) {
      registrar({ evento: "orcamento_esgotado" });
      return;
    }
    situacao.parouPorErro = true;
    // Resposta fora do formato ou acesso negado antes de existir fluxo (por exemplo, ao descobrir
    // o início do histórico): para a execução, com o código de sempre.
    if (fluxoFalhou(erro, "atividades")) return;
    if (erro instanceof ChaveInvalidaError) {
      registrar({ evento: "chave_invalida" });
      situacao.chaveRecusada = true;
      situacao.erroCodigo = "chave_invalida";
      situacao.pausaAte = em(agora, ESPERA_APOS_CHAVE_INVALIDA_SEGUNDOS);
    } else if (erro instanceof LimiteExcedidoError) {
      // Dobra a espera a cada 429 seguido (15 min, 30 min, 1 h, ... até 6 h), nunca menos que o
      // pedido pela Garmin: esperar de verdade, sem insistir.
      situacao.falhasDeLimite += 1;
      const crescente = Math.min(
        ESPERA_BASE_APOS_429_SEGUNDOS * 2 ** (situacao.falhasDeLimite - 1),
        ESPERA_MAXIMA_APOS_429_SEGUNDOS,
      );
      const espera = Math.min(
        Math.max(erro.esperarSegundos, crescente),
        ESPERA_MAXIMA_APOS_429_SEGUNDOS,
      );
      registrar({ evento: "limite_garmin", esperarSegundos: espera });
      situacao.erroCodigo = "limite_garmin";
      situacao.pausaAte = em(agora, espera);
    } else if (erro instanceof GarminIndisponivelError) {
      registrar({ evento: "garmin_indisponivel", status: erro.status });
      situacao.erroCodigo = "garmin_indisponivel";
    } else if (erro instanceof RedeGarminError) {
      registrar({ evento: "erro_de_rede" });
      situacao.erroCodigo = "rede";
    } else {
      // Erro nosso (banco, bug): nada do erro vai para o log, que poderia carregar dados.
      registrar({ evento: "erro_interno" });
      situacao.erroCodigo = "erro_interno";
    }
  }

  const codigo = situacao.erroCodigo ?? erroDeFluxo;
  const sucesso = codigo === null;
  const statusFinal: StatusDaChave = situacao.chaveRecusada
    ? "invalida"
    : situacao.garminRespondeu
      ? "ok"
      : situacao.statusAnterior;

  await registrarFimDaExecucao(
    banco,
    {
      statusDaChave: statusFinal,
      chaveVenceEm: deps.venceEm,
      erroCodigo: codigo,
      sucesso,
      executou: true,
      pausaAte: situacao.pausaAte,
      falhasDeLimiteSeguidas: situacao.erroCodigo === "limite_garmin" ? situacao.falhasDeLimite : 0,
    },
    iso,
  );
  orcamento.d1 += 1;

  const resumo: ResumoDaExecucao = {
    resultado: situacao.parouPorErro ? "parada_por_erro" : "concluida",
    janelas,
    requisicoesGarmin: orcamento.garmin,
    subrequests: orcamento.total,
  };
  registrar({
    evento: "execucao_concluida",
    modo,
    resultado: resumo.resultado,
    janelas,
    requisicoesGarmin: resumo.requisicoesGarmin,
    subrequests: resumo.subrequests,
  });
  return resumo;
}
