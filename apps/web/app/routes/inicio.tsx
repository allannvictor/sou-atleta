import { Link } from "react-router";

import { EMAIL_DE_CONTATO, NOME_DO_APP } from "../config";

export function meta() {
  return [
    { title: `${NOME_DO_APP}: seus dados de corrida em linguagem simples` },
    {
      name: "description",
      content:
        "O Sou Atleta está sendo feito para explicar os dados de corrida do seu relógio em linguagem simples. Ele descreve e estima, sem recomendar treino.",
    },
  ];
}

/**
 * Página inicial. O app ainda não funciona (fase fechada, sem conexão com a Garmin), então o
 * texto fala no futuro do que será oferecido e só afirma no presente o que já é verdade.
 */
export default function Inicio() {
  return (
    <>
      <h1>Seus dados de corrida, explicados em linguagem simples.</h1>
      <p className="destaque">
        O {NOME_DO_APP} está sendo feito para pegar os dados que o seu relógio Garmin já registra e
        mostrar o que eles querem dizer para você, sem jargão e sempre com uma comparação.
      </p>

      <section aria-labelledby="angulos">
        <h2 id="angulos">Três jeitos de olhar para os seus números</h2>
        <ul className="lista-cartoes">
          <li>
            <h3>O porquê</h3>
            <p>
              Cada número vai responder &ldquo;por que mudou?&rdquo;, apontando os treinos e os dias
              que o explicam.
            </p>
          </li>
          <li>
            <h3>Você contra você</h3>
            <p>
              O mesmo dado vai ser comparado com a semana passada, o mês passado e a mesma época do
              ano anterior.
            </p>
          </li>
          <li>
            <h3>Tradutor do seu relógio</h3>
            <p>
              O relógio Garmin mostra rótulos em inglês, como Training Status (como está o seu
              treino), Training Effect (o efeito de um treino sobre o seu condicionamento), Body
              Battery (a sua energia ao longo do dia) e HRV Status (como varia o tempo entre um
              batimento e outro do seu coração). Aqui eles vão virar frases claras, no seu caso.
            </p>
          </li>
        </ul>
      </section>

      <section aria-labelledby="limites">
        <h2 id="limites">O que o app vai mostrar e o que ele nunca fará</h2>
        <p>
          O {NOME_DO_APP} <strong>descreve e estima</strong>: vai mostrar o que aconteceu nos seus
          treinos e estimar coisas com base no seu histórico. Ele não recomenda treino, não
          prescreve e não julga. Também não substitui treinador, médico ou outro profissional.
        </p>
      </section>

      <section aria-labelledby="fase">
        <h2 id="fase">Como está hoje</h2>
        <p>
          O {NOME_DO_APP} está em <strong>fase fechada</strong>: ainda não funciona para o público,
          ainda não aceita cadastros e ainda não está conectado a nenhuma conta Garmin. O que existe
          hoje é este site, com esta página e a política de privacidade.
        </p>
        <p>
          As páginas públicas deste site não definem cookies e não têm rastreadores nem análise de
          uso. Os dados de saúde só serão tratados com o seu consentimento, como explica a{" "}
          <Link to="/privacidade">política de privacidade</Link>.
        </p>
      </section>

      <section aria-labelledby="contato">
        <h2 id="contato">Fale com a gente</h2>
        <p>
          Dúvidas, pedidos sobre seus dados ou sugestões:{" "}
          <a href={`mailto:${EMAIL_DE_CONTATO}`}>{EMAIL_DE_CONTATO}</a>.
        </p>
      </section>
    </>
  );
}
