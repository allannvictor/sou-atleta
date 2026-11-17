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
  sincronizacao_em_andamento:
    "Uma sincronização está terminando. Nada foi apagado. Peça de novo em alguns minutos.",
  nao_configurada: "A sincronização ainda não está ligada neste site. Nada foi apagado.",
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
            No Garmin Connect (o site da Garmin), apague a chave da Personal API. A Garmin a
            invalida na hora.
          </li>
          <li>
            Remova também a chave guardada no app. Nesta fase isso é feito no computador, com dois
            comandos (veja os detalhes abaixo).
          </li>
          <li>
            Depois, em &ldquo;Apagar minha conta&rdquo;, o app confere sozinho: se a chave ainda
            estiver guardada, ele recusa e não apaga nada.
          </li>
        </ol>
        <details>
          <summary>Detalhes técnicos do passo 2</summary>
          <p>
            Na pasta do projeto, rode estes dois comandos. O destino tem de ser a Worker{" "}
            <code>sou-atleta-sync</code>:
          </p>
          <pre>
            <code>
              pnpm --filter @sou-atleta/sync exec wrangler secret delete GARMIN_API_KEY
              {"\n"}
              pnpm --filter @sou-atleta/sync exec wrangler secret delete GARMIN_CHAVE_VENCE_EM
            </code>
          </pre>
          <p>
            Para conferir, <code>wrangler secret list</code> na <code>sou-atleta-sync</code> não
            pode mais listar nenhum nome que comece com <code>GARMIN_</code>.
          </p>
        </details>
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
