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
  let statusCode = responseStatusCode;
  const { nonce } = loadContext;

  const corpo = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
    {
      nonce,
      onError() {
        // Erro durante o streaming: a resposta já começou, só marcamos como falha.
        statusCode = 500;
      },
    },
  );

  // Robôs de busca esperam a página inteira (melhor para quem lê a política pelo Google).
  if (isbot(request.headers.get("user-agent") ?? "")) {
    await corpo.allReady;
  }

  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  return new Response(corpo, { status: statusCode, headers: responseHeaders });
}
