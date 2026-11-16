import { data, redirect } from "react-router";

import { ContaQuadro } from "../componentes/conta";
import { NOME_DO_APP } from "../config";
import { confirmacaoValida, pedirApagarTudo, resultadoDaUrl } from "../server/conta";
import type { Route } from "./+types/conta";

export function meta() {
  return [{ title: `Sua conta · ${NOME_DO_APP}` }, { name: "robots", content: "noindex" }];
}

export function loader({ request }: Route.LoaderArgs) {
  return { resultado: resultadoDaUrl(new URL(request.url).searchParams.get("apagar")) };
}

/**
 * "Apagar minha conta". A Worker já confirmou o acesso (JWT do Access e e-mail) antes de chegar
 * aqui. Como em "Atualizar agora", exigimos que o pedido venha da própria página (cabeçalho
 * Origin igual ao endereço do site) e que a pessoa tenha digitado a palavra de confirmação. Quem
 * apaga é a Worker `sync`, e só quando a chave da Garmin já saiu do cofre.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    return data({ erro: "Origem não permitida." }, { status: 403 });
  }
  const formulario = await request.formData();
  if (!confirmacaoValida(formulario.get("confirmacao"))) {
    return redirect("/app/conta?apagar=confirmacao_errada");
  }
  const resultado = await pedirApagarTudo(context.garmin.sync);
  return redirect(`/app/conta?apagar=${resultado}`);
}

export default function Conta({ loaderData }: Route.ComponentProps) {
  return <ContaQuadro resultado={loaderData.resultado} />;
}
