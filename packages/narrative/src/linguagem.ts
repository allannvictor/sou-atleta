/**
 * Checagem automática de linguagem (decisões 0001 e 0004): o app descreve e estima; nunca
 * recomenda, prescreve nem julga. Esta lista é validador do `narrative`: mudar exige aprovação
 * do dono (AGENTS.md). Todo texto que o app mostra sobre o desempenho passa por aqui nos testes.
 */

interface Grupo {
  readonly motivo: string;
  readonly termos: readonly string[];
}

const GRUPOS: readonly Grupo[] = [
  {
    motivo: "manda ou recomenda (o app descreve, não prescreve)",
    termos: [
      "descanse",
      "descansar",
      "treine",
      "treinar mais",
      "pare",
      "evite",
      "aumente",
      "diminua",
      "reduza",
      "faça",
      "procure",
      "tente",
      "considere",
      "recomend\\p{L}*",
      "aconselh\\p{L}*",
      "sugir\\p{L}*",
      "sugest\\p{L}*",
      "deve",
      "deveria",
      "devia",
      "precisa",
      "precisaria",
      "convém",
      "vale a pena",
      "o ideal",
      "o melhor é",
      "o certo",
      "o correto",
    ],
  },
  {
    motivo: "julga o desempenho (o app não diz se é bom ou ruim)",
    termos: [
      "bom",
      "boa",
      "bons",
      "boas",
      "ruim",
      "ruins",
      "péssim\\p{L}*",
      "ótim\\p{L}*",
      "excelente",
      "excelentes",
      "fraco",
      "fraca",
      "forte demais",
      "improdutiv\\p{L}*",
      "produtiv\\p{L}*",
      "preguiça",
      "preguiçoso",
      "desleixad\\p{L}*",
      "parabéns",
      "melhor",
      "pior",
      "ideal",
      "perfeit\\p{L}*",
    ],
  },
  {
    motivo: "fala de risco, lesão ou saúde (o app não substitui profissional)",
    termos: [
      "risco",
      "riscos",
      "perigo",
      "perigos",
      "perigos\\p{L}*",
      "lesão",
      "lesões",
      "lesionar",
      "machucar",
      "alerta",
      "alertas",
      "cuidado",
      "atenção",
      "preocupa\\p{L}*",
      "sobretreino",
      "overtraining",
      "excesso",
      "excessiv\\p{L}*",
      "diagnóstico",
      "doença",
      "médico",
      "tratamento",
    ],
  },
];

const PADROES = GRUPOS.map((grupo) => ({
  motivo: grupo.motivo,
  regex: new RegExp(`(?<![\\p{L}\\p{N}])(?:${grupo.termos.join("|")})(?![\\p{L}\\p{N}])`, "iu"),
}));

export interface ProblemaDeLinguagem {
  readonly trecho: string;
  readonly motivo: string;
}

/** Devolve cada trecho proibido encontrado; lista vazia = texto aprovado. */
export function verificarLinguagem(texto: string): readonly ProblemaDeLinguagem[] {
  const problemas: ProblemaDeLinguagem[] = [];
  for (const { motivo, regex } of PADROES) {
    const achado = regex.exec(texto);
    if (achado !== null) problemas.push({ trecho: achado[0], motivo });
  }
  return problemas;
}

/** Frase longa demais para a regra "frases curtas" da 0001. */
export const MAXIMO_DE_PALAVRAS_POR_FRASE = 28;

export function frasesLongas(texto: string): readonly string[] {
  return texto
    .split(/(?<=[.!?])\s+/)
    .filter((frase) => frase.trim().split(/\s+/).length > MAXIMO_DE_PALAVRAS_POR_FRASE);
}
