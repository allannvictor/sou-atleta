import { data, redirect } from "react-router";

import { AreaFechada } from "../componentes/area-fechada";
import { NOME_DO_APP } from "../config";
import { lerPainel, pedirAtualizacao, resultadoDaUrl } from "../server/garmin";
import type { Route } from "./+types/app";

export function meta() {
  return [{ title: `Área fechada · ${NOME_DO_APP}` }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const painel = await lerPainel(context.garmin, new Date());
  const resultado = resultadoDaUrl(new URL(request.url).searchParams.get("atualizacao"));
  return { painel, resultado };
}

/**
 * "Atualizar agora". A Worker já confirmou o acesso (JWT do Access e e-mail) antes de chegar
 * aqui. Como o botão é um formulário, também exigimos que o pedido venha da própria página
 * (cabeçalho Origin igual ao endereço do site): um site de fora não consegue disparar a
 * atualização. A chave da Garmin não passa por aqui: o site só pede à Worker `sync`.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    return data({ erro: "Origem não permitida." }, { status: 403 });
  }
  const resultado = await pedirAtualizacao(context.garmin.sync);
  return redirect(`/app?atualizacao=${resultado}`);
}

export default function Area({ loaderData }: Route.ComponentProps) {
  return <AreaFechada painel={loaderData.painel} resultado={loaderData.resultado} />;
}
