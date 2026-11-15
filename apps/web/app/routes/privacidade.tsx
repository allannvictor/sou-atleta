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
          públicas não definem cookies e não têm rastreadores nem análise de uso. Os registros de
          funcionamento do site estão desligados: o projeto não guarda registros de quem o visita. O
          app ainda não está conectado a nenhuma conta Garmin, então{" "}
          <strong>ainda não trata dados de saúde</strong>.
        </p>
        <p>
          As partes que dependem dessa conexão estão marcadas com &ldquo;Ainda não ativo&rdquo; e
          descrevem o que vamos cumprir quando ela existir. Antes de qualquer dado real entrar, esta
          política será atualizada, com nova data.
        </p>
        <p>O {NOME_DO_APP} é para pessoas com 18 anos ou mais.</p>
      </div>

      <Secao numero={1} titulo="Quais dados">
        <p>
          <strong>Hoje, nas páginas públicas:</strong> nenhum dado que você forneça. A Cloudflare,
          empresa que entrega o site, processa dados técnicos da conexão, como o endereço de
          internet (IP) do seu aparelho, para o site funcionar e se proteger de abusos. O projeto
          não guarda esses dados.
        </p>
        <p>
          <strong>Hoje, na área fechada:</strong> o acesso é restrito ao responsável pelo projeto. O
          serviço Cloudflare Access confere o e-mail de quem tenta entrar e guarda, só nessa área,
          um cookie de sessão (chamado CF_Authorization) para manter o login. Visitantes das páginas
          públicas não passam por isso.
        </p>
        <AindaNaoAtivo />
        <p>
          Quando o conector com a Garmin existir: atividades de corrida, frequência cardíaca,
          variabilidade da frequência cardíaca (HRV), sono, estresse e perfil de treino, vindos da
          sua conta Garmin. Na primeira etapa, não pedimos a senha da sua conta Garmin, seu nome
          completo nem o trajeto de GPS das corridas.
        </p>
      </Secao>

      <Secao numero={2} titulo="Para quê e por quanto tempo">
        <p>
          Hoje, os dados técnicos da conexão servem só para o site funcionar com segurança, e o
          projeto não os guarda.
        </p>
        <AindaNaoAtivo />
        <p>
          Quando houver dados de saúde, eles serão usados só para calcular e explicar as métricas do
          próprio atleta. Nada é vendido, compartilhado ou usado para publicidade.
        </p>
        <p>
          Seus dados ficam guardados enquanto a sua conta estiver conectada, até você apagá-los ou
          desconectar. Depois disso, eles são apagados (veja a seção 7).
        </p>
      </Secao>

      <Secao numero={3} titulo="Por que podemos usar seus dados (base legal)">
        <AindaNaoAtivo />
        <p>
          A lei brasileira de proteção de dados (LGPD) trata dados de saúde como dados sensíveis,
          que pedem mais cuidado. Por isso, antes de usar qualquer um deles, o app vai pedir o seu{" "}
          <strong>consentimento específico e destacado</strong>, em uma tela só para isso, no
          primeiro acesso. Sem o seu consentimento, nenhum dado de saúde é usado.
        </p>
      </Secao>

      <Secao numero={4} titulo="Onde os dados ficam e como são protegidos">
        <p>
          O site roda na Cloudflare, que pode processar a conexão em servidores fora do Brasil. A
          conexão entre o seu navegador e o site é protegida (o endereço começa com https).
        </p>
        <AindaNaoAtivo />
        <p>
          Quando houver dados de saúde, eles ficarão guardados na Cloudflare, possivelmente em
          servidores fora do Brasil. A lei chama isso de transferência internacional de dados, e
          vamos avisar aqui e no consentimento antes de ela começar.
        </p>
        <p>
          Como vamos protegê-los: a chave de acesso à sua conta Garmin fica guardada de forma
          protegida e é apagada quando você desconectar (seção 6), e a inteligência artificial só
          recebe números, sem seu nome nem seu e-mail (seção 5).
        </p>
        <p>
          Se houver um incidente de segurança que possa trazer risco ou dano a você, avisamos você e
          a Autoridade Nacional de Proteção de Dados (ANPD), como a lei exige, em prazo razoável. O
          aviso diz o que aconteceu, quais dados foram afetados e o que estamos fazendo. Ele chega
          pelo meio de contato que o app tiver registrado para você e também fica publicado neste
          site.
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

      <Secao numero={6} titulo="Sua conta Garmin">
        <p>Hoje não existe nenhuma conexão com a Garmin e nenhuma chave de acesso guardada.</p>
        <AindaNaoAtivo />
        <p>
          Não pedimos a senha da sua conta Garmin. Usamos só uma chave de acesso, que a Garmin gera
          com a sua autorização.
        </p>
        <p>
          Na primeira etapa, usada só pelo responsável pelo projeto, a chave pessoal fica num local
          protegido da Cloudflare (o &ldquo;cofre de segredos&rdquo;) e nunca é gravada em banco de
          dados, em registros de funcionamento ou em arquivos. Na etapa seguinte, com o botão
          &ldquo;Conectar com Garmin&rdquo;, a chave de acesso fica guardada de forma protegida
          (embaralhada, o que se chama criptografia) e é apagada quando você desconectar.
        </p>
      </Secao>

      <Secao numero={7} titulo="Seus direitos">
        <p>
          Hoje o site não guarda dados seus, então não há o que apagar. Mesmo assim, os direitos
          abaixo valem desde já. Para exercer qualquer um deles, escreva para{" "}
          <a href={`mailto:${EMAIL_DE_CONTATO}`}>{EMAIL_DE_CONTATO}</a>. Respondemos nos prazos que
          a lei prevê.
        </p>
        <p>Pelo artigo 18 da LGPD, você pode pedir:</p>
        <ul className="lista-simples">
          <li>confirmação de que tratamos dados seus;</li>
          <li>acesso aos seus dados;</li>
          <li>correção de dados incompletos, errados ou desatualizados;</li>
          <li>
            anonimização, bloqueio ou eliminação de dados desnecessários, em excesso ou tratados
            fora da lei;
          </li>
          <li>portabilidade dos seus dados para outro serviço;</li>
          <li>eliminação dos dados tratados com o seu consentimento;</li>
          <li>informação sobre com quais entidades compartilhamos os seus dados;</li>
          <li>informação sobre a possibilidade de não dar o consentimento e suas consequências;</li>
          <li>revogação do consentimento, a qualquer momento.</li>
        </ul>
        <p>
          Você também pode apresentar uma reclamação à Autoridade Nacional de Proteção de Dados
          (ANPD).
        </p>
        <AindaNaoAtivo />
        <p>
          Quando houver dados de saúde, você poderá ver, baixar e apagar tudo com um clique, e
          revogar o acesso na própria Garmin.{" "}
          <strong>Ao desconectar ou sair, apagamos seus dados do app imediatamente.</strong> Cópias
          de segurança mantidas pela infraestrutura podem levar um tempo para sumir por completo;
          elas não são usadas para nenhuma outra finalidade, e o prazo exato será informado aqui na
          atualização que antecede a entrada de qualquer dado real.
        </p>
      </Secao>

      <Secao numero={8} titulo="Compartilhamento">
        <p>
          Nada é vendido, compartilhado ou usado para publicidade. Hoje, os dados técnicos da
          conexão passam apenas pela Cloudflare, que hospeda o site em nosso nome.
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
        <p>Quando esta política mudar, a data de atualização no topo da página muda junto.</p>
      </Secao>
    </>
  );
}
