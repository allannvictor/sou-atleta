import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/inicio.tsx"),
  route("privacidade", "routes/privacidade.tsx"),
  // A trava de /app fica na Worker (app/server/requisicao.ts), antes de qualquer rota.
  route("app", "routes/app.tsx"),
  route("app/conta", "routes/conta.tsx"),
] satisfies RouteConfig;
