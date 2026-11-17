import { RESULTADOS_DO_APAGAR, type ResultadoDoApagar } from "@sou-atleta/db";

/**
 * "Sua conta" (issue #22): Sair, Desconectar a Garmin e Apagar minha conta. O site NUNCA apaga
 * dados nem mexe na chave: pede à Worker `sync`, por ligação interna, que é quem escreve no
 * banco. A chave da Garmin não passa por aqui.
 */

export { RESULTADOS_DO_APAGAR, type ResultadoDoApagar };

/** O que a tela sabe mostrar, além do que a `sync` responde. */
export type ResultadoNaTela = ResultadoDoApagar | "confirmacao_errada";

/** Encerra a sessão do Cloudflare Access neste aparelho. Não apaga nada. */
export const CAMINHO_DE_SAIDA = "/cdn-cgi/access/logout";

/** O que a pessoa digita para confirmar. Maiúsculas, exatamente assim. */
export const PALAVRA_DE_CONFIRMACAO = "APAGAR";

export function confirmacaoValida(valor: FormDataEntryValue | null): boolean {
  return valor === PALAVRA_DE_CONFIRMACAO;
}

/** Pede à `sync` que apague tudo. Nunca lança: qualquer falha vira "erro". */
export async function pedirApagarTudo(sync: Fetcher | undefined): Promise<ResultadoDoApagar> {
  if (sync === undefined) return "nao_configurada";
  try {
    const resposta = await sync.fetch("https://sync.interno/apagar-tudo", { method: "POST" });
    const corpo: unknown = await resposta.json();
    const resultado =
      typeof corpo === "object" && corpo !== null && "resultado" in corpo ? corpo.resultado : null;
    return RESULTADOS_DO_APAGAR.find((r) => r === resultado) ?? "erro";
  } catch {
    return "erro";
  }
}

/** Aceita só os resultados conhecidos na URL (`?apagar=`); qualquer outra coisa é ignorada. */
export function resultadoDaUrl(valor: string | null): ResultadoNaTela | null {
  const conhecidos: readonly ResultadoNaTela[] = [...RESULTADOS_DO_APAGAR, "confirmacao_errada"];
  return conhecidos.find((r) => r === valor) ?? null;
}
