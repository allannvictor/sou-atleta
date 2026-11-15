import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: AppLoadContext,
): Promise<Response> {
  const { nonce } = loadContext;

  const corpo = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
    // Sem `onError` de propósito: assim o React mantém o registro de erro padrão. Um `onError`
    // vazio engoliria erros de renderização sem deixar rastro, e o status da resposta já está
    // decidido quando o streaming começa, então marcar falha ali não mudaria nada.
    { nonce },
  );

  // Robôs de busca esperam a página inteira (melhor para quem lê a política pelo Google).
  if (isbot(request.headers.get("user-agent") ?? "")) {
    await corpo.allReady;
  }

  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  return new Response(corpo, { status: responseStatusCode, headers: responseHeaders });
}
