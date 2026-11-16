import {
  avancarProgresso,
  DIAS_DA_IMPORTACAO_INICIAL,
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
  registrarCodigoNoEstado,
  tentarPegarTrava,
  type Banco,
  type CodigoDeErro,
  type ComandoDeLote,
  type FotoDaSincronizacao,
  type Fluxo,
  type ProgressoDoFluxo,
  type ResultadoDaAtualizacao,
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
  TokenRecusadoError,
  type ClienteGarmin,
} from "@sou-atleta/garmin";

import {
  ESPERA_APOS_RECUSA_SEGUNDOS,
  ESPERA_BASE_APOS_429_SEGUNDOS,
  ESPERA_MAXIMA_APOS_429_SEGUNDOS,
  INTERVALO_MINIMO_AO_ABRIR_SEGUNDOS,
  INTERVALO_MINIMO_MANUAL_SEGUNDOS,
  ORCAMENTO,
  REVALIDAR_PERFIL_HORAS,
  SOBREPOSICAO_DIAS,
  SUBREQUESTS_MAXIMOS,
  TRAVA_SEGUNDOS,
  type Modo,
} from "./limites.js";
import type { OndeFalhou, Registrador } from "./log.js";

/**
 * A sincronização com a Garmin (issue #5). Não há rotina agendada: ela roda quando o dono abre
 * `/app` e quando aperta "Atualizar agora". Uma execução:
 *
 * 1. lê o estado, decide se roda (pausa por 429, intervalo mínimo, outra execução em curso) e
 *    pega a trava;
 * 2. renova perfil e zonas de FC, no máximo uma vez por dia;
 * 3. na primeira execução, define a importação inicial: os últimos 90 dias;
 * 4. importa janelas de datas, uma por vez. Cada janela e o avanço do progresso entram no banco
 *    no MESMO lote: se algo interromper, a próxima execução retoma dali, sem duplicar nem pular
 *    dia. Enquanto os 90 dias não terminam, cada execução traz o próximo pedaço; depois, cada
 *    execução busca desde a última sincronização, relendo alguns dias para pegar o que foi editado;
 * 5. confere, com a sobra, se a FC das atividades veio de pulso ou de cinta;
 * 6. grava como terminou (códigos curtos, nunca texto de erro) e solta a trava.
 *
 * O que não couber fica para a próxima abertura ou clique.
 */

export type ChaveDoCofre =
  | { readonly tipo: "ok"; readonly cliente: ClienteGarmin }
  | { readonly tipo: "ausente" }
  | { readonly tipo: "mal_formada" };

export interface Dependencias {
  readonly banco: Banco;
  /**
   * Trava mecânica (`POLITICA_REVISTA` no `wrangler.jsonc`): enquanto for falso, a sync não fala
   * com a Garmin, mesmo com a chave cadastrada. Só vira verdadeiro no PR que fecha a #29 (política
   * revista), depois da #22.
   */
  readonly liberada: boolean;
  readonly chave: ChaveDoCofre;
  /** Vencimento da chave (`YYYY-MM-DD`) informado pelo dono, se válido. */
  readonly venceEm: string | null;
  readonly agora: () => Date;
  readonly registrar: Registrador;
}

export type MotivoDeIgnorar =
  "pausada" | "sem_chave" | "ja_em_andamento" | "muito_cedo" | "nao_liberada";
export type Resultado = "concluida" | "parada_por_erro" | MotivoDeIgnorar;

export interface ResumoDaExecucao {
  readonly resultado: Resultado;
  readonly janelas: number;
  readonly requisicoesGarmin: number;
  readonly subrequests: number;
  /** A execução de fato trouxe e gravou dados da Garmin. */
  readonly buscouDados: boolean;
  readonly erroCodigo: CodigoDeErro | null;
}

export type Preparacao =
  | { readonly tipo: "ignorada"; readonly motivo: MotivoDeIgnorar }
  | { readonly tipo: "pronta"; readonly executar: () => Promise<ResumoDaExecucao> };

/** Como o botão e a abertura da página contam o desfecho para o atleta. */
export function resultadoParaOSite(resumo: ResumoDaExecucao): ResultadoDaAtualizacao {
  switch (resumo.resultado) {
    case "pausada":
    case "sem_chave":
    case "ja_em_andamento":
    case "muito_cedo":
    case "nao_liberada":
      return resumo.resultado;
    case "concluida":
      return resumo.erroCodigo === null ? "atualizada" : "atualizada_em_parte";
    case "parada_por_erro":
      switch (resumo.erroCodigo) {
        case "chave_invalida":
          return "chave_recusada";
        case "token_recusado":
          return "token_recusado";
        case "limite_garmin":
          return "pausada";
        case "garmin_indisponivel":
        case "rede":
          return "garmin_fora";
        default:
          return resumo.buscouDados ? "atualizada_em_parte" : "erro";
      }
  }
}

// ---------------------------------------------------------------------------------------------
// Regras de janela (puras, testadas à parte)
// ---------------------------------------------------------------------------------------------

export interface Janela {
  readonly de: string;
  readonly ate: string;
}

/**
 * Próxima janela a buscar. Durante a importação inicial, segue do dia seguinte ao último dia
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

/**
 * Qual fluxo recebe a próxima janela. Todos os fluxos estão sempre "devidos" (a cota é protegida
 * pelo intervalo entre execuções, não por fluxo). Ordem, igual ao abrir a página e no botão:
 *
 * 1. quem ainda não completou os 90 dias vem antes de quem já completou;
 * 2. dentro de cada grupo, as atividades primeiro (é o treino que o atleta quer ver);
 * 3. depois, o rodízio: o verificado há mais tempo vai primeiro (nunca verificado, antes de todos).
 *
 * Cada fluxo recebe no máximo uma janela por execução.
 */
export function proximoFluxo(
  progresso: ReadonlyMap<Fluxo, ProgressoDoFluxo>,
  jaFeitos: ReadonlySet<Fluxo>,
): Fluxo | null {
  const candidatos = FLUXOS.filter((f) => progresso.has(f) && !jaFeitos.has(f));
  const incompleto = (f: Fluxo) => (progresso.get(f)?.historicoCompleto === true ? 1 : 0);
  const verificadoEm = (f: Fluxo) => progresso.get(f)?.verificadoEm ?? "";
  const ordenados = [...candidatos].sort(
    (a, b) =>
      incompleto(a) - incompleto(b) ||
      Number(b === "atividades") - Number(a === "atividades") ||
      verificadoEm(a).localeCompare(verificadoEm(b)) ||
      FLUXOS.indexOf(a) - FLUXOS.indexOf(b),
  );
  return ordenados[0] ?? null;
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

type Onde = Fluxo | "perfil" | "zonas" | "detalhe";

/** Onde o problema apareceu, para o log: a troca do token tem lugar próprio. */
function ondeFalhou(erro: unknown, onde: Onde): OndeFalhou {
  if (erro instanceof RespostaInesperadaError && erro.endpoint.includes("personal-api-key/token")) {
    return "token";
  }
  return onde === "detalhe" ? "detalhe_da_atividade" : onde;
}

/** O problema foi na troca da chave por token: afeta toda a execução, não um fluxo só. */
function ehErroDeToken(erro: unknown): erro is RespostaInesperadaError | PedidoRecusadoError {
  return (
    (erro instanceof RespostaInesperadaError || erro instanceof PedidoRecusadoError) &&
    erro.endpoint.includes("personal-api-key/token")
  );
}

const SEM_RESUMO = { janelas: 0, requisicoesGarmin: 0, buscouDados: false, erroCodigo: null };

/**
 * Primeira parte: decide se a execução roda e pega a trava. Fica separada de `executar` para o
 * site poder responder na hora quando ninguém precisa esperar (abrir a página).
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
  // Depois do "inserir se não existir" no mesmo lote o estado sempre existe.
  if (estado === null) throw new Error("estado da sincronização ausente");

  const ignorar = (motivo: MotivoDeIgnorar) => {
    registrar({ evento: "execucao_ignorada", modo, motivo });
    return { tipo: "ignorada", motivo } as const;
  };

  // Trava mecânica: sem a política revista, nada de Garmin, nem com a chave cadastrada.
  if (!deps.liberada) {
    if (estado.erroCodigo !== "nao_liberada") {
      await registrarCodigoNoEstado(banco, "nao_liberada", iso);
    }
    return ignorar("nao_liberada");
  }

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

  // Pausa por 429 vale sempre, inclusive para o botão. A pausa por chave ou token recusado só
  // segura a abertura da página: quem cadastrou outra chave aperta o botão para testar.
  if (
    estado.pausaAte !== null &&
    estado.pausaAte > iso &&
    (modo === "ao_abrir" || estado.erroCodigo === "limite_garmin")
  ) {
    return ignorar("pausada");
  }
  const intervalo =
    modo === "ao_abrir" ? INTERVALO_MINIMO_AO_ABRIR_SEGUNDOS : INTERVALO_MINIMO_MANUAL_SEGUNDOS;
  if (
    estado.ultimaExecucaoEm !== null &&
    agora.getTime() - Date.parse(estado.ultimaExecucaoEm) < intervalo * 1000
  ) {
    return ignorar("muito_cedo");
  }

  const trava = await tentarPegarTrava(banco, iso, em(agora, TRAVA_SEGUNDOS));
  orcamento.d1 += 2; // `tentarPegarTrava` faz duas idas ao banco
  if (!trava.obtida) return ignorar("ja_em_andamento");
  if (trava.anteriorInterrompida) {
    // A execução anterior foi cortada (por exemplo, pelo limite de CPU): fica visível no painel
    // até uma execução terminar bem.
    registrar({ evento: "execucao_anterior_interrompida" });
    await registrarCodigoNoEstado(banco, "execucao_interrompida", iso);
    orcamento.d1 += 1;
  }

  return {
    tipo: "pronta",
    executar: () => executar(deps, modo, foto, orcamento, chave.cliente),
  };
}

/** Prepara e executa, quando ninguém precisa esperar entre as duas partes. */
export async function sincronizar(deps: Dependencias, modo: Modo): Promise<ResumoDaExecucao> {
  const preparacao = await prepararExecucao(deps, modo);
  if (preparacao.tipo === "ignorada") {
    return { resultado: preparacao.motivo, subrequests: 1, ...SEM_RESUMO };
  }
  return preparacao.executar();
}

interface Situacao {
  /** Status que já estava gravado (a chave só vira `ok` com uma resposta boa da Garmin). */
  statusAnterior: StatusDaChave;
  /** A Garmin recusou a chave nesta execução. */
  chaveRecusada: boolean;
  /** A Garmin aceitou a chave (houve resposta boa, ou a troca por token funcionou). */
  chaveAceita: boolean;
  erroCodigo: CodigoDeErro | null;
  /** Problema que afetou só um fluxo; a execução seguiu com os outros. */
  erroDeFluxo: CodigoDeErro | null;
  pausaAte: string | null;
  falhasDeLimite: number;
  buscouDados: boolean;
  parouPorErro: boolean;
  janelas: number;
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
  registrar({ evento: "execucao_iniciada", modo });

  const estado = foto.estado;
  const sit: Situacao = {
    statusAnterior:
      estado === null ||
      estado.statusDaChave === "ausente" ||
      estado.statusDaChave === "mal_formada"
        ? "nao_verificada"
        : estado.statusDaChave,
    chaveRecusada: false,
    chaveAceita: false,
    erroCodigo: null,
    erroDeFluxo: null,
    pausaAte: null,
    falhasDeLimite: estado?.falhasDeLimiteSeguidas ?? 0,
    buscouDados: false,
    parouPorErro: false,
    janelas: 0,
  };

  /** Erros que só afetam um fluxo: registra e segue com os outros. */
  const fluxoFalhou = (erro: unknown, onde: Onde): boolean => {
    if (ehErroDeToken(erro)) return false; // para a execução inteira (ver `tratarErroFatal`)
    if (erro instanceof RespostaInesperadaError || erro instanceof PedidoRecusadoError) {
      registrar({
        evento: "formato_inesperado",
        onde: ondeFalhou(erro, onde),
        campos: erro instanceof RespostaInesperadaError ? [...erro.campos] : [],
      });
      sit.erroDeFluxo ??= "formato_inesperado";
      return true;
    }
    if (erro instanceof AcessoNegadoError) {
      registrar({ evento: "acesso_negado", onde: ondeFalhou(erro, onde) });
      sit.erroDeFluxo ??= "acesso_negado";
      return true;
    }
    return false;
  };

  /** Importa uma janela de um fluxo e avança o progresso, tudo no mesmo lote. */
  const importarJanela = async (
    fluxo: Fluxo,
    p: ProgressoDoFluxo,
    hoje: string,
  ): Promise<ProgressoDoFluxo> => {
    const janela = proximaJanela(p, hoje);
    const comandos: ComandoDeLote[] = [];
    let itens = 0;

    if (fluxo === "atividades") {
      let inicio = 0;
      for (;;) {
        const pagina = await cliente.atividades({ ...janela, inicio });
        sit.chaveAceita = true;
        for (const a of pagina) comandos.push(gravarAtividade(banco, a, iso));
        itens += pagina.length;
        inicio += pagina.length;
        if (pagina.length < ATIVIDADES_POR_PAGINA) break;
        // Mais uma página: se não couber, abandona a janela inteira (nada foi gravado). O
        // orçamento comporta bem mais de 300 atividades numa janela, mais do que qualquer atleta.
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
    sit.chaveAceita = true;

    const importacaoInicialCompleta = p.historicoCompleto || janela.ate >= hoje;
    comandos.push(
      avancarProgresso(
        banco,
        { fluxo, importadoAte: janela.ate, historicoCompleto: importacaoInicialCompleta },
        iso,
      ),
    );
    await executarLote(banco, comandos);
    orcamento.d1 += 1;
    sit.buscouDados = true;
    registrar({ evento: "janela_importada", fluxo, itens, importacaoInicialCompleta });
    return {
      ...p,
      importadoAte: janela.ate,
      historicoCompleto: importacaoInicialCompleta,
      verificadoEm: iso,
    };
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
        sit.chaveAceita = true;
        await executarLote(banco, [
          gravarPerfil(banco, perfil, iso),
          ...zonas.map((zona) => gravarZonaFc(banco, zona, iso)),
        ]);
        orcamento.d1 += 1;
        sit.buscouDados = true;
        fuso = perfil.fusoHorario ?? fuso;
        registrar({ evento: "perfil_atualizado" });
      } catch (erro) {
        if (!fluxoFalhou(erro, "perfil")) throw erro;
      }
    }
    const hoje = hojeNoFuso(agora.getTime(), fuso);

    // 2. Primeira execução: a importação inicial traz só os últimos 90 dias.
    const faltando = FLUXOS.filter((f) => !progresso.has(f));
    if (faltando.length > 0) {
      const inicio = somarDias(hoje, -DIAS_DA_IMPORTACAO_INICIAL);
      await executarLote(banco, iniciarProgresso(banco, faltando, inicio, iso));
      orcamento.d1 += 1;
      for (const fluxo of faltando) {
        progresso.set(fluxo, {
          fluxo,
          inicio,
          importadoAte: null,
          historicoCompleto: false,
          verificadoEm: null,
        });
      }
      registrar({ evento: "importacao_inicial_iniciada" });
    }

    // 3. Janelas: rodízio entre os fluxos, no máximo `janelas` por execução.
    const feitos = new Set<Fluxo>();
    const comProblema = new Set<Fluxo>();
    while (sit.janelas < ORCAMENTO[modo].janelas) {
      const fluxo = proximoFluxo(progresso, new Set([...feitos, ...comProblema]));
      const p = fluxo === null ? undefined : progresso.get(fluxo);
      if (fluxo === null || p === undefined) break;
      if (!orcamento.cabe(2, 1)) {
        registrar({ evento: "orcamento_esgotado" });
        break;
      }
      try {
        progresso.set(fluxo, await importarJanela(fluxo, p, hoje));
        feitos.add(fluxo);
        sit.janelas += 1;
      } catch (erro) {
        if (erro instanceof OrcamentoEsgotado) {
          registrar({ evento: "orcamento_esgotado" });
          break;
        }
        if (!fluxoFalhou(erro, fluxo)) throw erro;
        comProblema.add(fluxo);
      }
    }

    // 4. Com a sobra, confere se a FC veio do pulso ou de uma cinta.
    const conferencias = ORCAMENTO[modo].conferenciasDeFc;
    if (conferencias > 0 && orcamento.cabe(2, 2)) {
      try {
        const pendentes = await listarAtividadesSemOrigemDeFc(banco, conferencias);
        orcamento.d1 += 1;
        const comandos: ComandoDeLote[] = [];
        for (const id of pendentes) {
          if (!orcamento.cabe(2, 1)) break;
          const origem = await cliente.origemDeFc(id);
          sit.chaveAceita = true;
          comandos.push(gravarOrigemDeFc(banco, id, origem, iso));
        }
        if (comandos.length > 0) {
          await executarLote(banco, comandos);
          orcamento.d1 += 1;
          sit.buscouDados = true;
          registrar({ evento: "origem_de_fc_conferida", atividades: comandos.length });
        }
      } catch (erro) {
        if (!fluxoFalhou(erro, "detalhe")) throw erro;
      }
    }
  } catch (erro) {
    tratarErroFatal(erro, sit, agora, registrar, fluxoFalhou);
  }

  const codigo = sit.erroCodigo ?? sit.erroDeFluxo;
  const statusFinal: StatusDaChave = sit.chaveRecusada
    ? "invalida"
    : sit.chaveAceita
      ? "ok"
      : sit.statusAnterior;

  await registrarFimDaExecucao(
    banco,
    {
      statusDaChave: statusFinal,
      chaveVenceEm: deps.venceEm,
      erroCodigo: codigo,
      buscouDados: sit.buscouDados,
      executou: true,
      pausaAte: sit.pausaAte,
      falhasDeLimiteSeguidas: sit.erroCodigo === "limite_garmin" ? sit.falhasDeLimite : 0,
    },
    iso,
  );
  orcamento.d1 += 1;

  const resumo: ResumoDaExecucao = {
    resultado: sit.parouPorErro ? "parada_por_erro" : "concluida",
    janelas: sit.janelas,
    requisicoesGarmin: orcamento.garmin,
    subrequests: orcamento.total,
    buscouDados: sit.buscouDados,
    erroCodigo: codigo,
  };
  registrar({
    evento: "execucao_concluida",
    modo,
    resultado: resumo.resultado,
    janelas: resumo.janelas,
    requisicoesGarmin: resumo.requisicoesGarmin,
    subrequests: resumo.subrequests,
    buscouDados: resumo.buscouDados,
  });
  return resumo;
}

/** Erros que param a execução inteira: traduz para um código curto e, quando cabe, uma pausa. */
function tratarErroFatal(
  erro: unknown,
  sit: Situacao,
  agora: Date,
  registrar: Registrador,
  fluxoFalhou: (erro: unknown, onde: Onde) => boolean,
): void {
  if (erro instanceof OrcamentoEsgotado) {
    registrar({ evento: "orcamento_esgotado" });
    return;
  }
  sit.parouPorErro = true;
  if (ehErroDeToken(erro)) {
    // A troca da chave por token respondeu algo que não entendemos: nada mais funciona agora.
    registrar({
      evento: "formato_inesperado",
      onde: "token",
      campos: erro instanceof RespostaInesperadaError ? [...erro.campos] : [],
    });
    sit.erroCodigo = "formato_inesperado";
    sit.pausaAte = em(agora, ESPERA_APOS_RECUSA_SEGUNDOS);
    return;
  }
  // Resposta fora do formato ou acesso negado fora de um fluxo.
  if (fluxoFalhou(erro, "atividades")) return;

  if (erro instanceof ChaveInvalidaError) {
    registrar({ evento: "chave_invalida" });
    sit.chaveRecusada = true;
    sit.erroCodigo = "chave_invalida";
    sit.pausaAte = em(agora, ESPERA_APOS_RECUSA_SEGUNDOS);
  } else if (erro instanceof TokenRecusadoError) {
    // A Garmin aceitou a chave e recusou o token: o problema é do conector, não da chave.
    registrar({ evento: "token_recusado" });
    sit.chaveAceita = true;
    sit.erroCodigo = "token_recusado";
    sit.pausaAte = em(agora, ESPERA_APOS_RECUSA_SEGUNDOS);
  } else if (erro instanceof LimiteExcedidoError) {
    // Dobra a espera a cada 429 seguido (15 min, 30 min, 1 h, ... até 6 h), nunca menos que o
    // pedido pela Garmin: esperar de verdade, sem insistir.
    sit.falhasDeLimite += 1;
    const crescente = Math.min(
      ESPERA_BASE_APOS_429_SEGUNDOS * 2 ** (sit.falhasDeLimite - 1),
      ESPERA_MAXIMA_APOS_429_SEGUNDOS,
    );
    const espera = Math.min(
      Math.max(erro.esperarSegundos, crescente),
      ESPERA_MAXIMA_APOS_429_SEGUNDOS,
    );
    registrar({ evento: "limite_garmin", esperarSegundos: espera });
    sit.erroCodigo = "limite_garmin";
    sit.pausaAte = em(agora, espera);
  } else if (erro instanceof GarminIndisponivelError) {
    registrar({ evento: "garmin_indisponivel", status: erro.status });
    sit.erroCodigo = "garmin_indisponivel";
  } else if (erro instanceof RedeGarminError) {
    registrar({ evento: "erro_de_rede" });
    sit.erroCodigo = "rede";
  } else {
    // Erro nosso (banco, bug): nada do erro vai para o log, que poderia carregar dados.
    registrar({ evento: "erro_interno" });
    sit.erroCodigo = "erro_interno";
  }
}
