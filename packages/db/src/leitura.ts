import { asc } from "drizzle-orm";

import type { Banco } from "./banco.js";
import { atividade, perfilTreino, progressoImportacao, zonaFc } from "./esquema.js";
import type { OrigemDeFc } from "./esquema.js";

/**
 * Leitura dos dados que a tela "Momento atual" usa (issues #37 e #38). Só lê: quem grava é a
 * Worker `sync`. Tudo numa única ida ao banco.
 */

export interface AtividadeLida {
  readonly id: number;
  readonly dataLocal: string;
  readonly tipo: string;
  readonly duracaoS: number;
  readonly distanciaM: number | null;
  readonly fcMedia: number | null;
  readonly fcOrigem: OrigemDeFc;
  readonly temposPorZonaS: readonly [
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
  ];
}

export interface ZonaLida {
  readonly esporte: string;
  readonly pisos: readonly [number, number, number, number, number];
}

export interface DadosDoMomentoAtual {
  readonly fusoHorario: string | null;
  /** Primeiro dia da janela de atividades já pedida à Garmin; `null` antes da primeira busca. */
  readonly inicioDasAtividades: string | null;
  /** A importação dos últimos 3 meses ainda não terminou. */
  readonly importacaoEmAndamento: boolean;
  readonly atividades: readonly AtividadeLida[];
  readonly zonas: readonly ZonaLida[];
}

export async function lerDadosDoMomentoAtual(banco: Banco): Promise<DadosDoMomentoAtual> {
  const [progresso, perfis, zonas, atividades] = await banco.batch([
    banco.select().from(progressoImportacao),
    banco.select({ fusoHorario: perfilTreino.fusoHorario }).from(perfilTreino),
    banco.select().from(zonaFc),
    banco.select().from(atividade).orderBy(asc(atividade.dataLocal), asc(atividade.id)),
  ]);
  const doFluxo = progresso.find((p) => p.fluxo === "atividades");
  return {
    fusoHorario: perfis[0]?.fusoHorario ?? null,
    inicioDasAtividades: doFluxo?.inicio ?? null,
    importacaoEmAndamento: doFluxo !== undefined && !doFluxo.historicoCompleto,
    atividades: atividades.map((a) => ({
      id: a.id,
      dataLocal: a.dataLocal,
      tipo: a.tipo,
      duracaoS: a.duracaoS,
      distanciaM: a.distanciaM,
      fcMedia: a.fcMedia,
      fcOrigem: a.fcOrigem,
      temposPorZonaS: [a.tempoZona1S, a.tempoZona2S, a.tempoZona3S, a.tempoZona4S, a.tempoZona5S],
    })),
    zonas: zonas.map((z) => ({
      esporte: z.esporte,
      pisos: [z.zona1Piso, z.zona2Piso, z.zona3Piso, z.zona4Piso, z.zona5Piso],
    })),
  };
}
