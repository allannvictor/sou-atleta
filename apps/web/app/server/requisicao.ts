import { type ObterChaves, verificarAcesso } from "./acesso";
import { ehRotaFechada } from "./rotas-fechadas";
import { comCabecalhosDeSeguranca, gerarNonce } from "./seguranca";

/** Entrega a requisição ao React Router. O nonce vai junto para os scripts da página. */
export type Renderizar = (request: Request, nonce: string) => Promise<Response>;

export interface OpcoesDaRequisicao {
  /** Ver `OpcoesDeCabecalhos.comCsp`. */
  readonly comCsp?: boolean;
  /** Só os testes trocam isto. */
  readonly obterChaves?: ObterChaves;
}

/**
 * Porta única de entrada da Worker. Tudo que sai daqui leva os cabeçalhos de segurança, e a
 * área fechada é checada antes de qualquer rota do React Router rodar: nenhuma tela futura
 * precisa lembrar de se proteger.
 */
export async function tratarRequisicao(
  request: Request,
  env: unknown,
  renderizar: Renderizar,
  { comCsp = true, obterChaves }: OpcoesDaRequisicao = {},
): Promise<Response> {
  const nonce = gerarNonce();
  const opcoes = { nonce, comCsp };
  const { pathname } = new URL(request.url);
  const fechada = ehRotaFechada(pathname);

  if (fechada) {
    const acesso = await verificarAcesso(request, env, obterChaves);
    if (!acesso.permitido) {
      const recusa = new Response(acesso.mensagem, {
        status: acesso.status,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      });
      return comCabecalhosDeSeguranca(recusa, opcoes);
    }
  }

  const resposta = await renderizar(request, nonce);
  if (fechada) {
    // Conteúdo da área fechada nunca fica em cache compartilhado.
    const protegida = new Response(resposta.body, resposta);
    protegida.headers.set("Cache-Control", "private, no-store");
    return comCabecalhosDeSeguranca(protegida, opcoes);
  }
  return comCabecalhosDeSeguranca(resposta, opcoes);
}
