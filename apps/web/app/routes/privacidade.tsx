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

/**
 * Marca as partes que descrevem um compromisso futuro, não algo que o app faz hoje. O trecho
 * escondido da tela existe para quem usa leitor de tela: sem ele, a etiqueta seria lida sozinha,
 * sem dizer até onde vale.
 */
function AindaNaoAtivo() {
  return (
    <p className="etiqueta">
      Ainda não ativo
      <span className="so-leitor">
        : o texto a seguir, até o fim desta parte, descreve uma etapa futura.
      </span>
    </p>
  );
}

/** Link para outra seção da política (os `id`s são `secao-N`). */
function RefSecao({ numero }: { readonly numero: number }) {
  return <a href={`#secao-${String(numero)}`}>seção {numero}</a>;
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
        <p>Hoje, o site do {NOME_DO_APP}:</p>
        <ul className="lista-simples">
          <li>
            <strong>não coleta dados de quem o visita</strong>;
          </li>
          <li>
            nas páginas públicas, não define cookies e não tem rastreadores nem análise de uso;
          </li>
          <li>
            está com os registros de funcionamento desligados: o projeto não guarda registros de
            quem o visita;
          </li>
          <li>
            ainda não está conectado a nenhuma conta Garmin, então{" "}
            <strong>ainda não trata dados de saúde</strong>.
          </li>
        </ul>
        <p>
          As partes que dependem dessa conexão estão marcadas com &ldquo;Ainda não ativo&rdquo; e
          descrevem o que vamos cumprir quando ela existir. Antes de qualquer dado real entrar, esta
          política será atualizada, com nova data.
        </p>
        <p>
          Quando a conexão existir, haverá três ações diferentes. Os detalhes estão na{" "}
          <RefSecao numero={7} />.
        </p>
        <AindaNaoAtivo />
        <dl className="acoes">
          <div>
            <dt>Sair</dt>
            <dd>
              Encerra a sua sessão, isto é, fecha o seu acesso neste aparelho. Nunca apaga dados.
            </dd>
          </div>
          <div>
            <dt>Desconectar a Garmin</dt>
            <dd>
              Interrompe a sincronização (o app deixa de buscar dados novos na Garmin) e apaga a
              chave de acesso (a autorização que a Garmin deu ao app, sem a sua senha). Mantém o
              histórico que já veio da Garmin.
            </dd>
          </div>
          <div>
            <dt>Apagar minha conta</dt>
            <dd>Apaga tudo o que o app guarda sobre você. Não dá para desfazer.</dd>
          </div>
        </dl>
        <p>
          O {NOME_DO_APP} é para pessoas com 18 anos ou mais. Se soubermos que alguém com menos de
          18 anos se cadastrou, apagamos os dados. Se você é responsável por uma pessoa com menos de
          18 anos que se cadastrou, ou sabe de um caso assim, escreva para{" "}
          <a href={`mailto:${EMAIL_DE_CONTATO}`}>{EMAIL_DE_CONTATO}</a> e apagamos os dados dessa
          pessoa.
        </p>
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
          um cookie de sessão (chamado CF_Authorization), um pequeno arquivo que mantém você
          conectado. Visitantes das páginas públicas não passam por isso.
        </p>
        <AindaNaoAtivo />
        <p>
          Quando o conector com a Garmin existir: atividades de corrida, frequência cardíaca,
          variabilidade da frequência cardíaca (HRV), sono, estresse e perfil de treino, vindos da
          sua conta Garmin. Na primeira etapa, não pedimos a senha da sua conta Garmin, seu nome
          completo nem o trajeto de GPS das corridas.
        </p>
        <p>
          Também guardaremos o e-mail que você usar para entrar, só para avisos sobre a sua conta,
          como o aviso antes de apagar por falta de uso e a confirmação de um pedido de exclusão.
          Não usamos esse e-mail para publicidade.
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
          Seus dados ficam guardados até você usar &ldquo;Apagar minha conta&rdquo; ou até 24 meses
          sem uso. Conta como uso entrar no app; a sincronização automática não conta. Antes de
          apagar por falta de uso, avisamos você por e-mail.
        </p>
        <p>
          O que &ldquo;Sair&rdquo;, &ldquo;Desconectar a Garmin&rdquo; e &ldquo;Apagar minha
          conta&rdquo; fazem com os seus dados está na <RefSecao numero={7} />.
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
        <p>
          Você pode revogar (retirar) o seu consentimento a qualquer momento. Se você revogar,
          paramos de usar os seus dados e apagamos a sua conta. Como pedir: <RefSecao numero={7} />.
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
          protegida e é apagada quando você desconectar a Garmin (<RefSecao numero={6} /> e{" "}
          <RefSecao numero={7} />
          ), e a inteligência artificial só recebe números, sem seu nome nem seu e-mail (
          <RefSecao numero={5} />
          ).
        </p>
        <p>
          Se houver um incidente de segurança que possa trazer risco ou dano a você, avisamos você e
          a Autoridade Nacional de Proteção de Dados (ANPD), como a lei exige, em prazo razoável. O
          aviso diz o que aconteceu, quais dados foram afetados e o que estamos fazendo. Ele chega
          pelo e-mail que você usar para entrar e também fica publicado neste site.
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
          &ldquo;Conectar a Garmin&rdquo;, a chave de acesso fica guardada de forma protegida
          (embaralhada, o que se chama criptografia) e é apagada quando você desconectar a Garmin. O
          que acontece com o histórico está na <RefSecao numero={7} />.
        </p>
      </Secao>

      <Secao numero={7} titulo="Seus direitos">
        <p>
          Hoje o site não guarda dados seus, então não há o que apagar. Mesmo assim, os direitos
          abaixo valem desde já. Para exercer qualquer um deles, escreva para{" "}
          <a href={`mailto:${EMAIL_DE_CONTATO}`}>{EMAIL_DE_CONTATO}</a>. Quando você pedir por
          e-mail, respondemos em até 15 dias, ou antes, se a lei exigir prazo menor.
        </p>
        <p>Pelo artigo 18 da LGPD, você pode pedir:</p>
        <ul className="lista-simples" aria-label="Direitos do artigo 18 da LGPD">
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
          Quando houver dados de saúde, você poderá ver, baixar e apagar tudo com um clique. Sair,
          desconectar a Garmin e apagar a conta são três ações diferentes:
        </p>
        <dl className="acoes">
          <div>
            <dt>Sair</dt>
            <dd>Só encerra a sua sessão. Nunca apaga dados.</dd>
          </div>
          <div>
            <dt>Desconectar a Garmin</dt>
            <dd>
              <p>
                Interrompe a sincronização e apaga a chave de acesso, mas mantém o histórico que já
                veio da Garmin, para você retomar de onde parou se reconectar. Para apagar esse
                histórico, use &ldquo;Apagar minha conta&rdquo;.
              </p>
              <p>
                Se você tirar a permissão pelo site ou pelo app da Garmin, o efeito é o mesmo: param
                de chegar dados novos, e o histórico guardado aqui continua até você apagar a conta.
                Isso não é uma ação do {NOME_DO_APP}: é uma configuração que fica na sua conta
                Garmin.
              </p>
              <p>
                Na etapa seguinte (ainda não ativa), também avisaremos a Garmin de que você
                desconectou.
              </p>
            </dd>
          </div>
          <div>
            <dt>Apagar minha conta</dt>
            <dd>
              <p>
                Apaga todos os seus dados no app, na hora. Não dá para desfazer; por isso, antes de
                apagar, você poderá baixar uma cópia dos seus dados.
              </p>
              <p>
                Cópias de segurança mantidas pela infraestrutura podem levar até 30 dias para sumir
                por completo; elas não são usadas para nenhuma outra finalidade.
              </p>
              <p>
                Apagar a conta também revoga o seu consentimento: paramos de usar os seus dados.
              </p>
            </dd>
          </div>
        </dl>
        <p>Nada disso apaga algo na Garmin: o app só guarda uma cópia dos seus dados.</p>
        <p>
          Se você pedir por e-mail para revogar o consentimento ou o acesso, tratamos o pedido como
          &ldquo;Apagar minha conta&rdquo;: apagamos tudo no app em até 15 dias e avisamos você por
          e-mail quando terminar.
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
