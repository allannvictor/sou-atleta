/** Número de bytes aleatórios do nonce do CSP. 16 bytes = 128 bits, acima do mínimo recomendado. */
const BYTES_DO_NONCE = 16;

/** Um ano em segundos. Sem `preload` de propósito: sair da lista de preload é lento e difícil. */
const HSTS_UM_ANO = 31_536_000;

/** Gera um nonce novo e imprevisível para cada resposta (CSP sem `unsafe-inline`). */
export function gerarNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(BYTES_DO_NONCE));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * CSP restritiva: scripts só do próprio site ou com o nonce da resposta, nada de plugins,
 * nada de embutir o site em outro (`frame-ancestors 'none'`).
 */
export function politicaDeConteudo(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export interface OpcoesDeCabecalhos {
  readonly nonce: string;
  /**
   * Desligado só no servidor de desenvolvimento: o Vite injeta scripts de recarga sem nonce.
   * Em produção e nos testes de interface (build real) fica sempre ligado.
   */
  readonly comCsp: boolean;
}

/** Os quatro cabeçalhos de segurança da especificação (issue #4). */
export function cabecalhosDeSeguranca({ nonce, comCsp }: OpcoesDeCabecalhos): Headers {
  const cabecalhos = new Headers({
    "Strict-Transport-Security": `max-age=${String(HSTS_UM_ANO)}`,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  if (comCsp) {
    cabecalhos.set("Content-Security-Policy", politicaDeConteudo(nonce));
  }
  return cabecalhos;
}

/** Devolve uma cópia da resposta com os cabeçalhos de segurança (respostas podem ser imutáveis). */
export function comCabecalhosDeSeguranca(resposta: Response, opcoes: OpcoesDeCabecalhos): Response {
  const cabecalhos = new Headers(resposta.headers);
  for (const [nome, valor] of cabecalhosDeSeguranca(opcoes)) {
    cabecalhos.set(nome, valor);
  }
  return new Response(resposta.body, {
    status: resposta.status,
    statusText: resposta.statusText,
    headers: cabecalhos,
  });
}
