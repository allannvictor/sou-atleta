import { Link } from "react-router";

import { EMAIL_DE_CONTATO, NOME_DO_APP } from "../config";

export function meta() {
  return [
    { title: `${NOME_DO_APP}: seus dados de corrida em linguagem simples` },
    {
      name: "description",
      content:
        "O Sou Atleta explica os dados de corrida do seu relógio em linguagem simples. Ele descreve e estima, sem recomendar treino.",
    },
  ];
}

export default function Inicio() {
  return (
    <>
      <h1>Seus dados de corrida, explicados em linguagem simples.</h1>
      <p className="destaque">
        O {NOME_DO_APP} pega os dados que o seu relógio de corrida já registra e mostra o que eles
        querem dizer para você, sem jargão e sempre com uma comparação.
      </p>

      <section aria-labelledby="angulos">
        <h2 id="angulos">Três jeitos de olhar para os seus números</h2>
        <ul className="lista-cartoes">
          <li>
            <h3>O porquê</h3>
            <p>
              Cada número responde &ldquo;por que mudou?&rdquo;, apontando os treinos e os dias que
              o explicam.
            </p>
          </li>
          <li>
            <h3>Você contra você</h3>
            <p>
              O mesmo dado comparado com a semana passada, o mês passado e a mesma época do ano
              anterior.
            </p>
          </li>
          <li>
            <h3>Tradutor do seu relógio</h3>
            <p>
              Os rótulos que o relógio mostra, como Training Status, Training Effect, Body Battery e
              HRV Status, explicados no seu caso.
            </p>
          </li>
        </ul>
      </section>

      <section aria-labelledby="limites">
        <h2 id="limites">O que o app faz e o que ele não faz</h2>
        <p>
          O {NOME_DO_APP} <strong>descreve e estima</strong>. Ele não recomenda treino, não
          prescreve e não julga. Também não substitui treinador, médico ou outro profissional.
        </p>
      </section>

      <section aria-labelledby="fase">
        <h2 id="fase">Em que pé está</h2>
        <p>
          O {NOME_DO_APP} está em <strong>fase fechada</strong>: ainda não aceita cadastros e ainda
          não está conectado a nenhuma conta Garmin. As páginas públicas deste site não usam
          cookies, rastreadores nem análise de uso. Os dados de saúde só serão tratados com o seu
          consentimento, como explica a <Link to="/privacidade">política de privacidade</Link>.
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
