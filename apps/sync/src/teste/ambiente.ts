import { criarBanco } from "@sou-atleta/db";
import { criarD1EmMemoria } from "@sou-atleta/db/teste";
import { criarClienteGarmin, GarminKey, somarDias } from "@sou-atleta/garmin";
import {
  atividadeBruta,
  criarGarminFalsa,
  diasSeguidos,
  type DadosDaGarmin,
  type GarminFalsa,
} from "@sou-atleta/garmin/teste";

import type { EventoDeLog } from "../log.js";
import type { ChaveDoCofre, Dependencias } from "../sincronizar.js";

/** Chave e vencimento de mentira usados em todos os testes. */
export const CHAVE_FALSA = "chave-de-mentira-0123456789abcdef";
export const HOJE = "2026-11-15";
export const QUINZE_MINUTOS = 15 * 60_000;

/** Histórico sintético: uma atividade a cada 3 dias e saúde todos os dias. */
export function historicoSintetico(): DadosDaGarmin {
  const dias = diasSeguidos("2026-07-01", 138); // até 2026-11-15
  const atividades = dias
    .filter((_, i) => i % 3 === 0)
    .map((dia, i) => atividadeBruta(1000 + i, dia));
  return { atividades, diasDeSaude: diasSeguidos("2026-05-02", 198) };
}

export interface OpcoesDoAmbiente {
  readonly dados?: DadosDaGarmin;
  readonly chave?: "ok" | "ausente" | "mal_formada";
  readonly venceEm?: string | null;
  readonly inicio?: string;
}

/** Tudo que um teste de sincronização precisa: banco, Garmin falsa, relógio e log capturado. */
export function montarAmbiente(opcoes: OpcoesDoAmbiente = {}) {
  let agoraMs = Date.parse(`${opcoes.inicio ?? HOJE}T12:00:00Z`);
  const agora = () => agoraMs;
  const memoria = criarD1EmMemoria();
  const banco = criarBanco(memoria.d1);
  const garmin: GarminFalsa = criarGarminFalsa({
    chave: CHAVE_FALSA,
    agora,
    dados: opcoes.dados ?? historicoSintetico(),
  });
  const eventos: EventoDeLog[] = [];
  const modoDaChave = opcoes.chave ?? "ok";

  let clienteAtual: ReturnType<typeof criarClienteGarmin> | null = null;
  const novoCliente = () => {
    clienteAtual = criarClienteGarmin({
      chave: GarminKey.de(CHAVE_FALSA),
      fetch: garmin.fetch,
      agora,
      dormir: (ms) => {
        agoraMs += ms;
        return Promise.resolve();
      },
    });
    return clienteAtual;
  };

  /** Dependências de uma execução nova (cliente novo, como numa invocação nova da Worker). */
  const dependencias = (): Dependencias => {
    const chave: ChaveDoCofre =
      modoDaChave === "ok" ? { tipo: "ok", cliente: novoCliente() } : { tipo: modoDaChave };
    return {
      banco,
      chave,
      venceEm: opcoes.venceEm === undefined ? "2027-03-01" : opcoes.venceEm,
      agora: () => new Date(agoraMs),
      registrar: (evento) => eventos.push(evento),
    };
  };

  return {
    memoria,
    banco,
    garmin,
    eventos,
    dependencias,
    agora,
    avancar: (ms: number) => {
      agoraMs += ms;
    },
    /** Subrequests reais de uma execução: idas ao banco mais requisições à Garmin. */
    subrequestsReais: () => memoria.chamadas() + garmin.requisicoes.length,
  };
}

export { somarDias };
