import { CAMINHO_DE_SAIDA, PALAVRA_DE_CONFIRMACAO, type ResultadoNaTela } from "../server/conta";

/**
 * Tela "Sua conta" (issue #22). Três ações diferentes, em linguagem simples (0001):
 * sair não apaga nada; desconectar a Garmin mantém o histórico; apagar a conta apaga tudo.
 * Tudo isto vale só para a cópia dos dados no banco do app: nada é apagado na Garmin.
 */

export const MENSAGENS_DO_APAGAR: Readonly<Record<ResultadoNaTela, string>> = {
  apagado: "Pronto. Tudo o que o app guardava foi apagado.",
  chave_presente:
    "Antes de apagar, desconecte a Garmin: a chave ainda está no cofre. Siga os passos da seção anterior e peça de novo.",
  nao_configurada: "A sincronização ainda não está ligada, então não há o que apagar daqui.",
  erro: "Não conseguimos apagar agora. Nada foi apagado. Peça de novo em instantes.",
  confirmacao_errada: `Nada foi apagado. Digite ${PALAVRA_DE_CONFIRMACAO}, em maiúsculas, para confirmar.`,
};

export function ContaQuadro({ resultado }: { readonly resultado: ResultadoNaTela | null }) {
  return (
    <>
      <p>
        <a href="/app">Voltar para o início</a>
      </p>
      <h1>Sua conta</h1>
      <p>
        Três ações diferentes. Todas valem só para a cópia dos seus dados no banco do app: nada é
        apagado na Garmin.
      </p>

      <section aria-labelledby="titulo-sair">
        <h2 id="titulo-sair">Sair</h2>
        <p>Sair encerra a sua sessão neste aparelho. Seus dados continuam guardados.</p>
        <p>
          <a className="botao" href={CAMINHO_DE_SAIDA}>
            Sair
          </a>
        </p>
      </section>

      <section aria-labelledby="titulo-desconectar">
        <h2 id="titulo-desconectar">Desconectar a Garmin</h2>
        <p>
          Desconectar interrompe a busca de dados novos. O que já veio da Garmin continua no app até
          você apagar a conta.
        </p>
        <ol>
          <li>
            No Garmin Connect Web, apague a chave da Personal API. A Garmin a invalida na hora.
          </li>
          <li>
            Remova a chave do cofre de segredos da Cloudflare, na Worker{" "}
            <code>sou-atleta-sync</code>, com <code>wrangler secret delete GARMIN_API_KEY</code> e
            depois <code>wrangler secret delete GARMIN_CHAVE_VENCE_EM</code>.
          </li>
          <li>
            Abra o início e toque em &ldquo;Atualizar agora&rdquo;: o quadro da Garmin passa a dizer
            que a chave não está cadastrada.
          </li>
        </ol>
      </section>

      <section aria-labelledby="titulo-apagar">
        <h2 id="titulo-apagar">Apagar minha conta</h2>
        <p>
          Apaga tudo o que o app guardou sobre você: atividades, sono, HRV, resumos do dia, zonas e
          perfil. Não dá para desfazer. Para apagar, a Garmin tem de estar desconectada (passos
          acima).
        </p>
        <p>
          O que fica de fora: o que está na própria Garmin; os registros de login do Cloudflare
          Access; as cópias de segurança do banco, que somem em até 7 dias; e os registros técnicos
          da sincronização, que somem em até 3 dias e não têm dados de saúde.
        </p>
        {resultado === null ? null : (
          <p role="status" className="aviso-suave">
            {MENSAGENS_DO_APAGAR[resultado]}
          </p>
        )}
        <form method="post">
          <p>
            <label htmlFor="confirmacao">Para confirmar, digite {PALAVRA_DE_CONFIRMACAO}</label>
            <br />
            <input
              id="confirmacao"
              name="confirmacao"
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              required
            />
          </p>
          <button type="submit" className="botao">
            Apagar tudo
          </button>
        </form>
      </section>
    </>
  );
}
