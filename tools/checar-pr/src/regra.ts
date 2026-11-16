// Por que: o GitHub fecha a issue só com palavra-chave em inglês (close, closes, closed, fix,
// fixes, fixed, resolve, resolves, resolved) seguida de #N, e cada issue precisa da sua própria
// palavra-chave. "Fecha #N" é ignorado em silêncio e a issue continua aberta depois do merge
// (issues #4, #11 e #21).
// Fonte: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue
//
// Regra de processo (decisão do dono, 16/11/2026): um PR que não fecha issue usa "Refs #N"
// (há issue relacionada) ou "Sem issue: <motivo>" (não há issue). O motivo é obrigatório.

const REPOSITORIO = "allannvictor/sou-atleta";

// Referência a uma issue deste repositório: #N, owner/repo#N ou URL de issue. Outros repositórios não contam.
const REF = String.raw`(?:https://github\.com/${REPOSITORIO}/issues/|${REPOSITORIO}#|#)\d+\b`;

const PALAVRAS_EM_INGLES = String.raw`close[sd]?|fix(?:e[sd])?|resolve[sd]?`;

// Palavra-chave, uma referência, e depois as referências da lista ("Closes #5, #6"):
// o GitHub só fecha a primeira, então as da lista são conferidas à parte.
const FECHAMENTO_EM_INGLES = new RegExp(
  String.raw`\b(?:${PALAVRAS_EM_INGLES}):?\s+(${REF})((?:\s*(?:,|\be\b|\band\b)\s*${REF})*)`,
  "gi",
);

// Português que o GitHub ignora. Só vale no início de uma linha (opcionalmente depois de marcador
// de lista): assim "Isso não fecha #7" é prosa e não vira orientação de troca.
const VERBOS_EM_PORTUGUES = String.raw`fech(?:a|ar|am|e|ado|ada|ados|adas|ei|aram)|resolv(?:e|a|er|ido|ida)|corrig(?:e|ir|ido|ida)`;

const FECHAMENTO_EM_PORTUGUES = new RegExp(
  String.raw`^[ \t]*(?:[-*+][ \t]+)?(${VERBOS_EM_PORTUGUES})\b(?:[ \t]+(?:a|o|à))?(?:[ \t]+issue)?[ \t]*:?[ \t]+(${REF})((?:[ \t]*(?:,|\be\b|\band\b)[ \t]*${REF})*)`,
  "gim",
);

// Marcação explícita para PR que trata de uma issue sem fechá-la.
const REFERENCIA = new RegExp(String.raw`\bRefs?:?\s+(${REF})`, "gi");

// Marcação para PR sem issue. Só conta no início de uma linha, como "Sem issue: passagem de sessão".
const SEM_ISSUE = /^[ \t]*(?:[-*+][ \t]+)?Sem issue:([^\n]*)$/gim;

export type ResultadoChecagem = {
  readonly ok: boolean;
  readonly erros: readonly string[];
};

const numerosDe = (trecho: string): string[] => [...trecho.matchAll(/\d+\b/g)].map((m) => m[0]);

// Comentários HTML do modelo, blocos cercados e código inline não contam: o GitHub não processa
// palavras-chave dentro de código, e o exemplo do modelo não pode fazer a checagem passar.
function semComentariosNemCodigo(corpo: string): string {
  return corpo
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(^|\n)[ \t]*(`{3,}|~{3,})[\s\S]*?(?:\n[ \t]*\2[ \t]*(?=\n|$)|$)/g, "$1")
    .replace(/`+[^`\n]+`+/g, "");
}

export function verificarDescricao(corpo: string): ResultadoChecagem {
  const texto = semComentariosNemCodigo(corpo);
  const erros: string[] = [];

  const emIngles = new Set<string>();
  const naListaEmIngles = new Set<string>();
  for (const m of texto.matchAll(FECHAMENTO_EM_INGLES)) {
    numerosDe(m[1] ?? "").forEach((n) => emIngles.add(n));
    numerosDe(m[2] ?? "").forEach((n) => naListaEmIngles.add(n));
  }
  for (const n of naListaEmIngles) {
    if (!emIngles.has(n)) {
      erros.push(
        `A issue #${n} vem depois de vírgula, sem palavra-chave própria. O GitHub fecha só a primeira issue da lista. Escreva "Closes #${n}" para cada issue que o PR fecha.`,
      );
    }
  }

  const emPortugues = new Map<string, string>();
  for (const m of texto.matchAll(FECHAMENTO_EM_PORTUGUES)) {
    const verbo = m[1] ?? "";
    for (const n of [...numerosDe(m[2] ?? ""), ...numerosDe(m[3] ?? "")]) {
      if (!emPortugues.has(n)) emPortugues.set(n, verbo);
    }
  }
  for (const [n, verbo] of emPortugues) {
    if (!emIngles.has(n)) {
      erros.push(
        `A issue #${n} aparece numa linha que começa com "${verbo}", palavra em português. O GitHub só fecha a issue com palavra-chave em inglês: troque por "Closes #${n}". Se o PR não deve fechar a issue, use "Refs #${n}".`,
      );
    }
  }

  const semIssue = [...texto.matchAll(SEM_ISSUE)].map((m) => (m[1] ?? "").trim());
  for (const motivo of semIssue) {
    if (motivo === "") {
      erros.push(
        '"Sem issue:" precisa de um motivo depois dos dois pontos, por exemplo "Sem issue: passagem de sessão".',
      );
    }
  }

  const refs = new Set<string>();
  for (const m of texto.matchAll(REFERENCIA)) numerosDe(m[1] ?? "").forEach((n) => refs.add(n));

  // Com erro em português, o aviso já diz o que fazer; não emitir um segundo, falso, sobre falta de issue.
  const temReferencia = emIngles.size > 0 || refs.size > 0 || semIssue.length > 0;
  if (!temReferencia && emPortugues.size === 0) {
    erros.push(
      'A descrição não diz qual issue este PR trata. Use "Closes #N" se o PR fecha a issue ao ser mesclado, "Refs #N" se ele só se relaciona com ela, ou "Sem issue: <motivo>" se não há issue.',
    );
  }

  return { ok: erros.length === 0, erros };
}
