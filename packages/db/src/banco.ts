import { drizzle } from "drizzle-orm/d1";

import * as esquema from "./esquema.js";

/** Liga o Drizzle ao D1 da Worker. */
export function criarBanco(d1: D1Database) {
  return drizzle(d1, { schema: esquema });
}

export type Banco = ReturnType<typeof criarBanco>;
