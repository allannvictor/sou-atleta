import { isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { EMAIL_DE_CONTATO, NOME_DO_APP } from "./config";

export function Layout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href="data:," />
        <Meta />
        <Links />
      </head>
      <body>
        <a className="pular" href="#conteudo">
          Pular para o conteúdo
        </a>
        <header className="topo">
          <Link to="/" className="marca">
            {NOME_DO_APP}
          </Link>
        </header>
        <main id="conteudo" className="pagina">
          {children}
        </main>
        <footer className="rodape">
          <p>
            <Link to="/privacidade">Política de privacidade</Link>
            {" · "}
            <a href={`mailto:${EMAIL_DE_CONTATO}`}>{EMAIL_DE_CONTATO}</a>
          </p>
          <p>
            Garmin é marca de seus titulares. O {NOME_DO_APP} é um projeto independente e usa a
            Garmin apenas como fonte de dados.
          </p>
        </footer>
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const naoEncontrada = isRouteErrorResponse(error) && error.status === 404;
  return (
    <>
      <title>
        {naoEncontrada
          ? `Página não encontrada · ${NOME_DO_APP}`
          : `Algo deu errado · ${NOME_DO_APP}`}
      </title>
      <h1>{naoEncontrada ? "Página não encontrada" : "Algo deu errado"}</h1>
      <p>
        {naoEncontrada
          ? "Não achamos a página que você procura."
          : "Não conseguimos mostrar esta página agora."}
      </p>
      <p>
        <Link to="/">Voltar para o início</Link>
      </p>
    </>
  );
}
