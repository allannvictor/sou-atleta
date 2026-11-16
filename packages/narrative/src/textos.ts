import type {
  AvisoDaCarga,
  CargaDoTreino,
  DistribuicaoDeIntensidade,
  TendenciaDoVolume,
  VariacaoDaCarga,
} from "@sou-atleta/core";

import { diaEMes, duracao, nomeDoTipo, numeroComUmaCasa, numeroInteiro } from "./formato.js";

/**
 * Modelos de texto do "Momento atual" (0004, etapa 0): o app funciona 100% sem IA. Os números
 * chegam prontos do `core`; aqui só viram frase. Cada texto passa pela checagem de linguagem
 * (`linguagem.ts`) nos testes. Tom da 0001: frases curtas, "você", sempre com comparação.
 */

const PRECISAO_DE_IGUAL = 1; // abaixo de 1% de diferença, "praticamente igual"

/** "Subiu 8% em relação a 7 dias atrás." (o app descreve a mudança, não a avalia). */
function mudanca(percentual: number | null): string {
  if (percentual === null) return "";
  if (Math.abs(percentual) < PRECISAO_DE_IGUAL) return " Ficou praticamente igual a 7 dias atrás.";
  return ` ${percentual > 0 ? "Subiu" : "Caiu"} ${numeroInteiro(Math.abs(percentual))}% em relação a 7 dias atrás.`;
}

export function conhecendoVoce(faltamDias: number, oQue: string): string {
  const dias = faltamDias === 1 ? "1 dia" : `${String(faltamDias)} dias`;
  return `Conhecendo você: faltam ${dias} de dados ${oQue}.`;
}

export function fraseDaBase(base: number, percentualContraSemanaPassada: number | null): string {
  return `Sua Base está em ${numeroInteiro(base)}.${mudanca(percentualContraSemanaPassada)}`;
}

export function fraseDaCargaRecente(
  cargaRecente: number,
  percentualContraSemanaPassada: number | null,
): string {
  return `Sua Carga recente está em ${numeroInteiro(cargaRecente)}.${mudanca(percentualContraSemanaPassada)}`;
}

export function fraseDoSaldo(saldo: number): string {
  const valor = numeroInteiro(saldo);
  if (Math.abs(saldo) < 0.5) {
    return `Seu Saldo está em ${valor}: sua Carga recente está igual à sua Base.`;
  }
  const posicao = saldo < 0 ? "acima" : "abaixo";
  return `Seu Saldo está em ${valor}: sua Carga recente está ${posicao} da sua Base.`;
}

export function fraseDaVariacao(variacao: VariacaoDaCarga): string {
  switch (variacao.tipo) {
    case "conhecendo":
      return conhecendoVoce(variacao.faltamDias, "para comparar com suas semanas anteriores");
    case "sem_comparacao":
      return `Nos últimos 7 dias, sua carga foi ${numeroInteiro(variacao.cargaDaSemana)}. Não há carga nas 6 semanas anteriores para comparar.`;
    case "calculada": {
      const diferenca = Math.abs(variacao.percentual);
      const direcao =
        diferenca < PRECISAO_DE_IGUAL
          ? "praticamente igual à"
          : `${numeroInteiro(diferenca)}% ${variacao.percentual > 0 ? "acima" : "abaixo"} da`;
      return `Sua carga dos últimos 7 dias foi ${numeroInteiro(variacao.cargaDaSemana)}, ${direcao} sua média das 6 semanas anteriores (${numeroInteiro(variacao.mediaSemanalAnterior)} por semana).`;
    }
  }
}

export function fraseDoTreino(treino: {
  readonly dataLocal: string;
  readonly tipo: string;
  readonly duracaoS: number;
  readonly carga: CargaDoTreino;
}): string {
  const base = `${diaEMes(treino.dataLocal)} · ${nomeDoTipo(treino.tipo)} · ${duracao(treino.duracaoS)}`;
  return treino.carga.tipo === "calculada"
    ? `${base} · carga ${numeroInteiro(treino.carga.valor)}`
    : `${base} · sem frequência cardíaca`;
}

export function avisoDaCarga(aviso: AvisoDaCarga): string {
  return aviso === "estimativa_simplificada"
    ? "Estimativa simplificada: a Garmin não informou o tempo em cada zona."
    : "Estimativa com margem de erro maior: o sensor de pulso erra mais em esforços fortes.";
}

export function fraseDosTreinosFora(quantos: number): string | null {
  if (quantos <= 0) return null;
  return quantos === 1
    ? "1 treino dos últimos 7 dias ficou fora da carga porque não tem frequência cardíaca."
    : `${String(quantos)} treinos dos últimos 7 dias ficaram fora da carga porque não têm frequência cardíaca.`;
}

function tendencia(percentual: number | null, oQue: string): string | null {
  if (percentual === null) return null;
  if (Math.abs(percentual) < PRECISAO_DE_IGUAL) {
    return `${oQue}: praticamente igual às 4 semanas anteriores.`;
  }
  return `${oQue}: ${numeroInteiro(Math.abs(percentual))}% ${percentual > 0 ? "acima" : "abaixo"} das 4 semanas anteriores.`;
}

export function frasesDaTendenciaDoVolume(t: TendenciaDoVolume): readonly string[] {
  return [
    tendencia(t.kmDeCorrida, "Km de corrida"),
    tendencia(t.tempoS, "Tempo de treino"),
    tendencia(t.treinos, "Número de treinos"),
  ].filter((frase): frase is string => frase !== null);
}

export function fraseDaSemana(semana: {
  readonly kmDeCorrida: number;
  readonly tempoS: number;
  readonly treinos: number;
}): string {
  const treinos = semana.treinos === 1 ? "1 treino" : `${String(semana.treinos)} treinos`;
  return `${numeroComUmaCasa(semana.kmDeCorrida)} km de corrida, ${duracao(semana.tempoS)} no total, ${treinos}.`;
}

export function fraseDaDistribuicao(d: DistribuicaoDeIntensidade): string {
  const [z1, z2, z3, z4, z5] = d.percentualPorZona;
  const maior = d.percentualPorZona.indexOf(Math.max(...d.percentualPorZona)) + 1;
  return `Nos últimos 28 dias, a maior parte do seu tempo foi na zona ${String(maior)} (${numeroInteiro(d.percentualPorZona[maior - 1] ?? 0)}%). Zonas 1 a 5: ${[z1, z2, z3, z4, z5].map((p) => `${numeroInteiro(p)}%`).join(", ")}.`;
}

/** Explicações de uma linha, mostradas junto de cada número (0001: termo técnico explicado). */
export const EXPLICACOES = {
  carga:
    "A carga mede quanto cada treino pesou: minutos em zonas de frequência cardíaca mais fortes valem mais.",
  base: "Quanto treino você sustenta no longo prazo: a média da sua carga nos últimos 42 dias.",
  cargaRecente: "Quanto treino pesou nos últimos dias: a média da sua carga nos últimos 7 dias.",
  saldo: "A Base menos a Carga recente.",
  importacaoEmAndamento:
    "Os últimos 3 meses ainda estão chegando da Garmin, então estes números ainda vão mudar.",
} as const;
