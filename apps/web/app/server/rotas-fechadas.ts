const MAXIMO_DE_DECODIFICACOES = 5;

/**
 * Diz se o caminho pertence à área fechada (`/app` e tudo que começa com isso).
 *
 * Por quê tanto cuidado: o React Router casa rotas sem diferenciar maiúsculas, decodifica o
 * caminho (`/%61pp` vira `/app`) e aceita `//app`. Se a trava olhasse o texto cru, essas formas
 * passariam direto. Aqui o caminho é normalizado antes de comparar. Também pegamos de propósito
 * `/app.data` (dados das telas) e qualquer `/app...`: recusar a mais é inofensivo, deixar passar
 * a menos não é. Caminho que não decodifica direito conta como fechado.
 */
export function ehRotaFechada(caminho: string): boolean {
  let atual = caminho;
  for (let tentativa = 0; tentativa < MAXIMO_DE_DECODIFICACOES; tentativa++) {
    let proximo: string;
    try {
      proximo = decodeURIComponent(atual);
    } catch {
      return true;
    }
    if (proximo === atual) {
      return atual
        .toLowerCase()
        .replace(/\/{2,}/g, "/")
        .startsWith("/app");
    }
    atual = proximo;
  }
  return true;
}
