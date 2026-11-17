import type { ReactNode } from "react";

import { EMAIL_DE_CONTATO, NOME_DO_APP, POLITICA_ATUALIZADA_EM } from "../config";

export function meta() {
  return [
    { title: `Política de privacidade · ${NOME_DO_APP}` },
    {
      name: "description",
      content:
        "Como o Sou Atleta trata dados pessoais: o que acontece hoje, na primeira etapa, e o que ainda não está ativo.",
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
 * Texto da política de privacidade (decisão 0007; revisão da issue #29, conector Garmin ativo).
 * Regra de ouro: só afirmar o que o app faz hoje. Na etapa 1, o único usuário é o responsável
 * pelo projeto, com os próprios dados. O que continua futuro vem marcado "Ainda não ativo".
 * Qualquer mudança de comportamento exige atualizar este texto e a data em `config.ts` antes de
 * entrar no ar.
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
            nas páginas públicas, <strong>não coleta dados de quem o visita</strong>, não define
            cookies e não tem rastreadores nem análise de uso;
          </li>
          <li>
            está com os registros de funcionamento desligados: o projeto não guarda registros de
            quem o visita;
          </li>
          <li>
            <strong>trata dados de saúde de uma única pessoa: o responsável pelo projeto</strong>,
            que usa a área fechada com os próprios dados da Garmin. Mais ninguém usa o app nesta
            fase;
          </li>
          <li>
            guarda, na rotina que busca os dados na Garmin, registros de eventos técnicos, por 3
            dias, feitos para não levar dados de saúde (<RefSecao numero={4} />
            );
          </li>
          <li>
            registra, no serviço que controla a entrada na área fechada, cada entrada, por 24 horas
            (<RefSecao numero={4} />
            ).
          </li>
        </ul>
        <p>
          O que ainda é futuro está marcado com &ldquo;Ainda não ativo&rdquo; e descreve o que vamos
          cumprir. Antes de qualquer mudança, esta política é atualizada, com nova data.
        </p>
        <p>
          Há três ações diferentes, na página &ldquo;Sua conta&rdquo;, dentro da área fechada. Os
          detalhes estão na <RefSecao numero={7} />.
        </p>
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
              Interrompe a sincronização (o app deixa de buscar dados novos na Garmin) e faz a chave
              de acesso (a autorização que a Garmin deu ao app, sem a sua senha) deixar de valer.
              Nesta fase, são dois passos feitos por você, à mão. Mantém o histórico que já veio da
              Garmin.
            </dd>
          </div>
          <div>
            <dt>Apagar minha conta</dt>
            <dd>
              Apaga os dados que o app guarda no banco, na hora. Não dá para desfazer. O que fica de
              fora está na <RefSecao numero={7} />.
            </dd>
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
          <strong>Nas páginas públicas:</strong> nenhum dado que você forneça. A Cloudflare, empresa
          que entrega o site, processa dados técnicos da conexão, como o endereço de internet (IP)
          do seu aparelho, para o site funcionar e se proteger de abusos. O projeto não guarda esses
          dados.
        </p>
        <p>
          <strong>Na área fechada:</strong> o acesso é restrito ao responsável pelo projeto. O
          serviço Cloudflare Access confere o e-mail de quem tenta entrar e guarda, só nessa área,
          um cookie de sessão (chamado CF_Authorization), um pequeno arquivo que mantém você
          conectado. Visitantes das páginas públicas não passam por isso. Para entrar, usa-se uma
          conta Google ou um código enviado por e-mail; com a conta Google, o Google fica sabendo de
          cada entrada, mas não recebe dados de saúde. O Access também registra cada entrada (
          <RefSecao numero={4} />
          ).
        </p>
        <p>
          <strong>Dados que vêm da Garmin</strong>, da conta do responsável pelo projeto. O app
          guarda uma cópia de:
        </p>
        <ul className="lista-simples" aria-label="Dados que vêm da Garmin">
          <li>
            atividades de todas as modalidades (corrida, pedal, natação e outras): data e hora de
            início, tipo, duração, distância, frequência cardíaca (FC) média e máxima, se a FC veio
            do pulso ou de uma cinta, tempo em cada zona de FC, VO2max (a estimativa da Garmin de
            quanto oxigênio o seu corpo usa no esforço máximo) e Training Effect (o efeito do
            treino, segundo a Garmin);
          </li>
          <li>
            variabilidade da frequência cardíaca (HRV) da noite (a média e o maior valor em 5
            minutos) e da semana, e o estado dela segundo a Garmin;
          </li>
          <li>sono: tempo total, tempo em cada fase e tempo acordado;</li>
          <li>
            resumo do dia: FC de repouso (e se veio do pulso ou de uma cinta), estresse e Body
            Battery (a sua energia ao longo do dia, segundo a Garmin);
          </li>
          <li>
            zonas de FC de cada esporte, o método e os valores usados para elas (FC máxima, de
            repouso e de limiar);
          </li>
          <li>
            perfil de treino: sistema de medidas, fuso horário e dias preferidos para treinar e para
            treinos longos.
          </li>
        </ul>
        <p>
          O fuso horário e a hora local das atividades revelam a região aproximada em que você está.
          O app não guarda o trajeto de GPS, a localização exata, o seu nome, o seu e-mail, a sua
          foto, a senha da Garmin nem a chave de acesso.
        </p>
        <p>
          O app também guarda informações técnicas da própria sincronização: até que dia os dados já
          vieram, quando ela rodou, a data de vencimento da chave informada pelo responsável e
          códigos curtos de erro. Nunca a chave de acesso.
        </p>
        <p>
          Na primeira vez, o app traz só os últimos 90 dias. Depois, busca só o que é novo, e só
          quando você abre o app ou toca em &ldquo;Atualizar agora&rdquo;.
        </p>
        <AindaNaoAtivo />
        <p>
          Na etapa seguinte, com outras pessoas, guardaremos o e-mail que você usar para entrar, só
          para avisos sobre a sua conta, como o aviso antes de apagar por falta de uso e a
          confirmação de um pedido de exclusão. Não usamos esse e-mail para publicidade.
        </p>
      </Secao>

      <Secao numero={2} titulo="Para quê e por quanto tempo">
        <p>
          Os dados técnicos da conexão servem só para o site funcionar com segurança, e o projeto
          não os guarda.
        </p>
        <p>
          Os dados que vêm da Garmin são usados só para calcular e explicar as métricas do próprio
          atleta. Nada é vendido, compartilhado ou usado para publicidade.
        </p>
        <p>
          Seus dados ficam guardados até você usar &ldquo;Apagar minha conta&rdquo;. O que
          &ldquo;Sair&rdquo;, &ldquo;Desconectar a Garmin&rdquo; e &ldquo;Apagar minha conta&rdquo;
          fazem com os seus dados está na <RefSecao numero={7} />.
        </p>
        <AindaNaoAtivo />
        <p>
          Na etapa seguinte, os dados também serão apagados depois de 24 meses sem uso. Conta como
          uso entrar no app. Antes de apagar por falta de uso, avisaremos você por e-mail.
        </p>
      </Secao>

      <Secao numero={3} titulo="Por que podemos usar seus dados (base legal)">
        <p>
          A lei brasileira de proteção de dados (LGPD) trata dados de saúde como dados sensíveis,
          que pedem mais cuidado. Nesta fase, a única pessoa cujos dados o app trata é o próprio
          responsável pelo projeto, que decidiu conectar a sua conta Garmin para usar os próprios
          dados. Nesta fase, o tratamento acontece por decisão do próprio titular, que é também o
          responsável pelo projeto. Ainda não existe tela de consentimento, porque ninguém mais usa
          o app.
        </p>
        <p>
          Você pode revogar (retirar) essa decisão a qualquer momento, e quem consentir depois
          também poderá. Se você revogar, paramos de usar os seus dados e apagamos a sua conta. Como
          pedir: <RefSecao numero={7} />.
        </p>
        <AindaNaoAtivo />
        <p>
          Antes de qualquer outra pessoa usar o app, ele vai pedir o seu{" "}
          <strong>consentimento específico e destacado</strong>, em uma tela só para isso, no
          primeiro acesso. Sem o seu consentimento, nenhum dado de saúde é usado.
        </p>
      </Secao>

      <Secao numero={4} titulo="Onde os dados ficam e como são protegidos">
        <p>
          O site roda na Cloudflare, que pode processar a conexão em servidores fora do Brasil. A
          conexão entre o seu navegador e o site é protegida (o endereço começa com https).
        </p>
        <p>
          Os dados que vêm da Garmin ficam guardados no banco de dados da Cloudflare,{" "}
          <strong>fora do Brasil</strong>, na América do Norte. O país exato é escolhido pela
          Cloudflare, perto dessa preferência. A lei chama isso de transferência internacional de
          dados.
        </p>
        <p>
          Como os protegemos: só o responsável pelo projeto entra na área fechada, depois de
          confirmar o e-mail; a chave de acesso à Garmin fica no cofre de segredos da Cloudflare (
          <RefSecao numero={6} />
          ); o app guarda só o necessário para as métricas (<RefSecao numero={1} />
          ); e a inteligência artificial, quando existir, só vai receber números, sem seu nome nem
          seu e-mail (<RefSecao numero={5} />
          ).
        </p>
        <p>
          <strong>Registros de funcionamento da sincronização.</strong> A rotina que busca os seus
          dados na Garmin guarda registros de funcionamento no serviço de registros da Cloudflare,
          por 3 dias. Eles dizem só o que aconteceu, por exemplo &ldquo;um pedaço dos seus dados
          chegou da Garmin&rdquo; ou &ldquo;a Garmin pediu para esperar&rdquo;. Nunca levam a sua
          chave de acesso, a autorização temporária que a Garmin entrega em troca dela, nem dados de
          saúde. Se acontecer um erro inesperado, a própria Cloudflare também pode registrá-lo. A
          rotina foi feita para que esses registros também não levem nada disso. Esses registros
          existem só nessa rotina: o site que você vê continua sem registros.
        </p>
        <p>
          <strong>Registros de entrada na área fechada.</strong> O Cloudflare Access registra cada
          entrada na área fechada: o e-mail, o endereço de internet (IP) e o país. No plano que o
          projeto usa, a Cloudflare guarda esses registros por 24 horas.
        </p>
        <p>
          Os prazos de 3 dias, de 24 horas e o das cópias de segurança (<RefSecao numero={7} />)
          valem no plano gratuito da Cloudflare, que o projeto usa. Se o plano mudar, esta política
          muda antes.
        </p>
        <p>
          Se houver um incidente de segurança que possa trazer risco ou dano a você, avisamos você e
          a Autoridade Nacional de Proteção de Dados (ANPD), como a lei exige, em prazo razoável. O
          aviso diz o que aconteceu, quais dados foram afetados e o que estamos fazendo, e fica
          publicado neste site.
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
        <p>
          Não pedimos a senha da sua conta Garmin. Usamos só uma chave de acesso, que a Garmin gera
          com a sua autorização.
        </p>
        <p>
          Nesta fase, a chave pessoal do responsável pelo projeto fica num local protegido da
          Cloudflare (o &ldquo;cofre de segredos&rdquo;), usado só pela rotina de sincronização, e
          nunca é gravada em banco de dados, em registros de funcionamento ou em arquivos. O app não
          consegue apagá-la sozinho: para desconectar, o responsável apaga a chave no site da
          Garmin, o que a faz deixar de valer na hora, e a remove do cofre.
        </p>
        <AindaNaoAtivo />
        <p>
          Na etapa seguinte, com o botão &ldquo;Conectar a Garmin&rdquo;, a chave de acesso fica
          guardada de forma protegida (embaralhada, o que se chama criptografia) e é apagada quando
          você desconectar a Garmin. O que acontece com o histórico está na <RefSecao numero={7} />.
        </p>
      </Secao>

      <Secao numero={7} titulo="Seus direitos">
        <p>
          Os direitos abaixo valem desde já. Para exercer qualquer um deles, escreva para{" "}
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
        <p>
          Sair, desconectar a Garmin e apagar a conta são três ações diferentes. As três ficam na
          página &ldquo;Sua conta&rdquo;, dentro da área fechada:
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
                Interrompe a sincronização e a chave de acesso deixa de valer, mas mantém o
                histórico que já veio da Garmin, para você retomar de onde parou se reconectar. Para
                apagar esse histórico, use &ldquo;Apagar minha conta&rdquo;.
              </p>
              <p>
                Nesta fase, desconectar tem dois passos, feitos por você: apagar a chave no site da
                Garmin e removê-la do cofre do app. A página &ldquo;Sua conta&rdquo; mostra como.
              </p>
              <p>
                Se você tirar a permissão pelo site ou pelo app da Garmin, o efeito é o mesmo: param
                de chegar dados novos, e o histórico guardado aqui continua até você apagar a conta.
                Isso não é uma ação do {NOME_DO_APP}: é uma configuração que fica na sua conta
                Garmin.
              </p>
              <p>
                Na etapa seguinte (ainda não ativa), desconectar será um botão, e também avisaremos
                a Garmin de que você desconectou.
              </p>
            </dd>
          </div>
          <div>
            <dt>Apagar minha conta</dt>
            <dd>
              <p>
                Apaga todos os seus dados no app, na hora. Não dá para desfazer. Para apagar, a
                chave da Garmin tem de já ter saído do cofre do app; senão, o app voltaria a buscar
                os dados.
              </p>
              <p>
                O que não é apagado: o que está na própria Garmin; os registros de entrada do
                Cloudflare Access, que somem em 24 horas; os registros da sincronização, que somem
                em até 3 dias e são feitos para não levar dados de saúde; e as cópias de segurança
                mantidas pela infraestrutura, que podem levar até 7 dias para sumir por completo e
                não são usadas para nenhuma outra finalidade.
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
        <AindaNaoAtivo />
        <p>
          Na etapa seguinte, você poderá ver e baixar uma cópia de todos os seus dados com um
          clique, inclusive antes de apagar a conta.
        </p>
      </Secao>

      <Secao numero={8} titulo="Compartilhamento">
        <p>
          Nada é vendido, compartilhado ou usado para publicidade. Os seus dados de saúde passam
          apenas pela Cloudflare, que hospeda o site, guarda os dados e controla a entrada na área
          fechada em nosso nome. O login da área fechada pode ser feito com uma conta Google; nesse
          caso, o Google fica sabendo de cada entrada, mas não recebe dados de saúde. O app só pede
          dados à Garmin; não envia dados seus para ela.
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
