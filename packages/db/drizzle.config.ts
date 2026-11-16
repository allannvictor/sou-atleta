import { defineConfig } from "drizzle-kit";

// Só para gerar as migrações (`pnpm --filter @sou-atleta/db migracao:gerar`): não conecta em
// nenhum banco. Quem aplica as migrações é o `wrangler d1 migrations apply`, que lê esta pasta.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/esquema.ts",
  out: "./migrations",
});
