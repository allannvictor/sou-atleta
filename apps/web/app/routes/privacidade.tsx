import type { ReactNode } from "react";

import { EMAIL_DE_CONTATO, NOME_DO_APP, POLITICA_ATUALIZADA_EM } from "../config";

export function meta() {
  return [
    { title: `Política de privacidade · ${NOME_DO_APP}` },
    {
      name: "description",
      content:
        "Como o Sou Atleta trata dados pessoais: o que acontece hoje, o que ainda não está ativo e o que prometemos cumprir.",
    },
  ];
}

/** Marca as partes que descrevem um compromisso futuro, não algo que o app faz hoje. */
function AindaNaoAtivo() {
  return <p className="etiqueta">Ainda não ativo</p>;
}

function Secao({
  numero,
  titulo,
  children,
}: {
  readonly numero: number;
  readonly titulo: string;
  readonly children: ReactNode;
}) {
  const id = `secao-${String(numero)}`;
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>
        {numero}. {titulo}
      </h2>
      {children}
    </section>
  );
}

/**
 * Texto da política de privacidade (decisão 0007). Regra de ouro: só afirmar o que o app faz
 * hoje. O que depende do conector Garmin vem marcado "Ainda não ativo" e descreve o
 * compromisso. Qualquer mudança de comportamento exige atualizar este texto e a data em
 * `config.ts` antes de entrar no ar.
 */
export default function Privacidade() {
  return (
    <>
      <h1>Política de privacidade</h1>
      <p>
        Última atualização:{" "}
        <time dateTime={POLITICA_ATUALIZADA_EM.iso}>{POLITICA_ATUALIZADA_EM.porExtenso}</time>.
      </p>

      <div className="resumo">
        <h2>Resumo de hoje</h2>
        <p>
          O site do {NOME_DO_APP} <strong>não coleta dados de quem o visita</strong>. As páginas
          públicas não usam cookies, rastreadores nem análise de uso. O app ainda não está conectado
          a nenhuma conta Garmin, então <strong>ainda não trata dados de saúde</strong>.
        </p>
        <p>
          As partes que dependem dessa conexão estão marcadas com &ldquo;Ainda não ativo&rdquo; e
          descrevem o que vamos cumprir quando ela existir. Antes de qualquer dado real entrar, esta
          política será atualizada, com nova data.
        </p>
        <p>O {NOME_DO_APP} é para maiores de 18 anos.</p>
      </div>

      <Secao numero={1} titulo="Quais dados">
        <p>
          <strong>Hoje, nas páginas públicas:</strong> nenhum dado que você forneça. A Cloudflare,
          empresa que entrega o site, processa dados técnicos de conexão, como o endereço IP, para o
          site funcionar e se proteger de abusos.
        </p>
        <p>
          <strong>Hoje, na área fechada:</strong> o acesso é restrito ao responsável pelo projeto. O
          serviço Cloudflare Access confere o e-mail de quem tenta entrar e guarda um cookie de
          sessão para manter o login. Visitantes das páginas públicas não passam por isso.
        </p>
        <AindaNaoAtivo />
        <p>
          Quando o conector com a Garmin existir: atividades de corrida, frequência cardíaca,
          variabilidade da frequência cardíaca (HRV), sono, estresse e perfil de treino, vindos da
          sua conta Garmin. Não pedimos a senha da sua conta Garmin, seu nome completo nem o trajeto
          de GPS das corridas.
        </p>
      </Secao>

      <Secao numero={2} titulo="Para quê">
        <p>Hoje, os dados técnicos de conexão servem só para o site funcionar com segurança.</p>
        <AindaNaoAtivo />
        <p>
          Quando houver dados de saúde, eles serão usados só para calcular e explicar as métricas do
          próprio atleta. Nada é vendido, compartilhado ou usado para publicidade.
        </p>
      </Secao>

      <Secao numero={3} titulo="Base legal">
        <AindaNaoAtivo />
        <p>
          Dados de saúde são dados pessoais sensíveis pela Lei Geral de Proteção de Dados (LGPD).
          Por isso, antes de tratar qualquer um deles, o app vai pedir o seu{" "}
          <strong>consentimento específico e destacado</strong>, em uma tela só para isso, no
          primeiro acesso. Sem o seu consentimento, nenhum dado de saúde é tratado.
        </p>
      </Secao>

      <Secao numero={4} titulo="Onde os dados ficam">
        <p>O site roda na Cloudflare, que pode processar a conexão em servidores fora do Brasil.</p>
        <AindaNaoAtivo />
        <p>
          Quando houver dados de saúde, eles ficarão guardados na Cloudflare, possivelmente fora do
          Brasil. Isso é uma transferência internacional de dados, e vamos avisar aqui e no
          consentimento antes de ela começar.
        </p>
      </Secao>

      <Secao numero={5} titulo="Inteligência artificial">
        <p>Hoje o site não usa inteligência artificial (IA).</p>
        <AindaNaoAtivo />
        <p>
          Quando existir, o texto de IA será um complemento: o app funciona sem ela. A IA, que roda
          na própria Cloudflare, vai receber só números já calculados pelo app, sem seu nome nem seu
          e-mail. A IA nunca calcula nem digita número.
        </p>
      </Secao>

      <Secao numero={6} titulo="Credenciais da Garmin">
        <p>Hoje não existe nenhuma conexão com a Garmin e nenhuma credencial guardada.</p>
        <AindaNaoAtivo />
        <p>
          Na primeira etapa, usada só pelo responsável pelo projeto, a chave pessoal da Garmin fica
          num cofre de segredos da Cloudflare e nunca é gravada em banco de dados, em registros de
          funcionamento (logs) ou em arquivos. Na etapa seguinte, com o botão &ldquo;Conectar com
          Garmin&rdquo;, o token de acesso fica criptografado e é apagado quando você desconectar.
        </p>
      </Secao>

      <Secao numero={7} titulo="Seus direitos">
        <p>
          Hoje o site não guarda dados seus, então não há o que apagar. Mesmo assim, você pode pedir
          informações ou exercer seus direitos previstos na LGPD escrevendo para{" "}
          <a href={`mailto:${EMAIL_DE_CONTATO}`}>{EMAIL_DE_CONTATO}</a>.
        </p>
        <AindaNaoAtivo />
        <p>
          Quando houver dados de saúde, você poderá ver, baixar e apagar tudo com um clique, e
          revogar o acesso na própria Garmin.{" "}
          <strong>Ao desconectar ou sair, apagamos todos os seus dados imediatamente.</strong>
        </p>
      </Secao>

      <Secao numero={8} titulo="Compartilhamento">
        <p>
          Nada é vendido, compartilhado ou usado para publicidade. Hoje, os dados técnicos de
          conexão passam apenas pela Cloudflare, que hospeda o site.
        </p>
        <AindaNaoAtivo />
        <p>
          Quando existirem, os cards para redes sociais só saem do app quando você decide criá-los e
          compartilhá-los.
        </p>
      </Secao>

      <Secao numero={9} titulo="Aviso de responsabilidade">
        <p>
          O {NOME_DO_APP} descreve e estima. Ele não recomenda treino, não prescreve e não julga.
          Não substitui treinador, médico ou outro profissional.
        </p>
      </Secao>

      <Secao numero={10} titulo="Contato e atualizações">
        <p>
          O responsável pelo tratamento dos dados é o projeto {NOME_DO_APP}, identificado pelo
          e-mail <a href={`mailto:${EMAIL_DE_CONTATO}`}>{EMAIL_DE_CONTATO}</a>.
        </p>
        <p>
          Quando esta política mudar, a data de atualização no topo muda junto. Última atualização:{" "}
          <time dateTime={POLITICA_ATUALIZADA_EM.iso}>{POLITICA_ATUALIZADA_EM.porExtenso}</time>.
        </p>
      </Secao>
    </>
  );
}
