// Por que: o GitHub fecha a issue só com palavras-chave em inglês (close, closes, closed, fix,
// fixes, fixed, resolve, resolves, resolved), seguidas de #N. "Fecha #N" é ignorado em silêncio
// e a issue continua aberta depois do merge (issues #4, #11 e #21).
// Fonte: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue

// Palavras-chave que o GitHub reconhece de fato.
const FECHAMENTO_EM_INGLES = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+#(\d+)/gi;

// Equivalentes em português que o GitHub ignora. "resolve" entra aqui só para pegar
// "Resolve a #N"; "Resolve #N" sem artigo já é válido em inglês e é aceito.
const FECHAMENTO_EM_PORTUGUES =
  /\b(?:fech(?:a|ar|am|e)|resolv(?:a|e|er)|corrig(?:e|ir))\b(?:\s+(?:a|à))?\s+#(\d+)/gi;

// Marcação explícita para PR que não fecha issue (passagem de sessão, passo intermediário).
const REFERENCIA = /\bRefs?:?\s+#(\d+)/gi;

export type ResultadoChecagem = {
  readonly ok: boolean;
  readonly erros: readonly string[];
};

function numeros(texto: string, padrao: RegExp): Set<string> {
  return new Set([...texto.matchAll(padrao)].map((m) => m[1] ?? ""));
}

// Comentários HTML do modelo de PR não contam: o exemplo "Closes #N" dentro do comentário
// não pode fazer a checagem passar.
export function verificarDescricao(corpo: string): ResultadoChecagem {
  const texto = corpo.replace(/<!--[\s\S]*?-->/g, "");

  const fechaEmIngles = numeros(texto, FECHAMENTO_EM_INGLES);
  const fechaEmPortugues = numeros(texto, FECHAMENTO_EM_PORTUGUES);
  const referencias = numeros(texto, REFERENCIA);

  const erros: string[] = [];

  for (const n of fechaEmPortugues) {
    if (!fechaEmIngles.has(n)) {
      erros.push(
        `Encontrei uma referência em português para a issue #${n}, mas o GitHub só fecha a issue com palavra-chave em inglês. Troque por "Closes #${n}". Sem isso, a issue #${n} continua aberta depois do merge.`,
      );
    }
  }

  if (fechaEmIngles.size === 0 && referencias.size === 0) {
    erros.push(
      'A descrição não diz qual issue este PR trata. Use "Closes #N" se o PR fecha a issue ao ser mesclado, ou "Refs #N" se ele só se relaciona com ela.',
    );
  }

  return { ok: erros.length === 0, erros };
}
