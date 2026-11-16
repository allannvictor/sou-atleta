import { createRequestHandler, type ServerBuild } from "react-router";

import { tratarRequisicao } from "../app/server/requisicao";

declare module "react-router" {
  interface AppLoadContext {
    /** Nonce do CSP desta resposta. */
    nonce: string;
    /**
     * O que a área fechada usa para falar da Garmin: o banco (só leitura) e a ligação com a
     * Worker `sync`. Nunca a chave da Garmin, e nunca o `env` inteiro (que tem a lista de e-mails).
     */
    garmin: { banco: D1Database | undefined; sync: Fetcher | undefined };
  }
}

// O tipo do módulo virtual gerado pelo React Router declara `basename: string | undefined`,
// mas `ServerBuild` espera `basename?: string`. Com `exactOptionalPropertyTypes` ligado (regra do
// projeto) o TypeScript recusa a diferença, que não existe em tempo de execução. A asserção fica
// só aqui, na fronteira com o framework, em vez de afrouxar o tsconfig inteiro.
const manipulador = createRequestHandler(
  () => import("virtual:react-router/server-build") as Promise<ServerBuild>,
  import.meta.env.MODE,
);

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return tratarRequisicao(
      request,
      env,
      (req, nonce) => manipulador(req, { nonce, garmin: { banco: env.DB, sync: env.SYNC } }),
      {
        comCsp: !import.meta.env.DEV,
      },
    );
  },
};
