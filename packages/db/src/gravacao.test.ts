import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { criarBanco } from "./banco.js";
import { atividade, diaSono, progressoImportacao } from "./esquema.js";
import {
  avancarProgresso,
  gravarAtividade,
  gravarDiaSono,
  gravarOrigemDeFc,
  iniciarProgresso,
  type NovaAtividade,
} from "./gravacao.js";
import { criarD1EmMemoria } from "./teste/d1-em-memoria.js";

const AGORA = "2026-11-15T10:00:00.000Z";

const umaAtividade = (id: number, extra: Partial<NovaAtividade> = {}): NovaAtividade => ({
  id,
  dataLocal: "2026-11-01",
  inicioLocal: "2026-11-01 07:00:00",
  inicioGmt: "2026-11-01 10:00:00",
  tipo: "running",
  duracaoS: 3000,
  ...extra,
});

describe("gravação idempotente", () => {
  it("gravar a mesma atividade duas vezes não duplica e não perde a origem da FC já conferida", async () => {
    const memoria = criarD1EmMemoria();
    const banco = criarBanco(memoria.d1);
    await banco.batch([gravarAtividade(banco, umaAtividade(10, { fcMedia: 150 }), AGORA)]);
    await banco.batch([gravarOrigemDeFc(banco, 10, "cinta", AGORA)]);
    await banco.batch([gravarAtividade(banco, umaAtividade(10, { fcMedia: 151 }), AGORA)]);

    const linhas = await banco.select().from(atividade);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      fonte: "garmin",
      fcMedia: 151,
      fcOrigem: "cinta",
      fcOrigemConferida: true,
    });
  });

  it("propriedade: importar a mesma lista de dias N vezes dá o mesmo resultado que uma vez", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.integer({ min: 1, max: 28 }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 4 }),
        async (dias, repeticoes) => {
          const memoria = criarD1EmMemoria();
          const banco = criarBanco(memoria.d1);
          for (let i = 0; i < repeticoes; i += 1) {
            await banco.batch([
              gravarDiaSono(banco, { data: "2026-01-01", sonoS: 1 }, AGORA),
              ...dias.map((dia) =>
                gravarDiaSono(
                  banco,
                  { data: `2026-02-${String(dia).padStart(2, "0")}`, sonoS: dia },
                  AGORA,
                ),
              ),
            ]);
          }
          expect(await banco.select().from(diaSono)).toHaveLength(dias.length + 1);
        },
      ),
      { numRuns: 25 },
    );
  });

  it("o progresso só avança junto com os dados: lote que falha não deixa nada para trás", async () => {
    const memoria = criarD1EmMemoria();
    const banco = criarBanco(memoria.d1);
    await banco.batch([...iniciarProgresso(banco, ["sono"], "2026-01-01", AGORA)] as never);
    await expect(
      banco.batch([
        gravarDiaSono(banco, { data: "2026-01-02", sonoS: 1 }, AGORA),
        avancarProgresso(
          banco,
          { fluxo: "sono", importadoAte: "2026-01-02", historicoCompleto: false },
          AGORA,
        ),
        // Violação do CHECK: derruba o lote inteiro.
        banco.insert(atividade).values({
          ...umaAtividade(1),
          fonte: "outra" as never,
          atualizadoEm: AGORA,
        }),
      ]),
    ).rejects.toThrow();

    expect(await banco.select().from(diaSono)).toHaveLength(0);
    const [progresso] = await banco.select().from(progressoImportacao);
    expect(progresso?.importadoAte).toBeNull();
  });
});
