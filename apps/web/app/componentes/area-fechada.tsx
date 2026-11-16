import { NOME_DO_APP } from "../config";
import type { PainelDaGarmin, ResultadoDaAtualizacao } from "../server/garmin";
import { PainelGarmin } from "./painel-garmin";

/** Conteúdo da área fechada: só quem tem acesso chega até aqui. As telas do app vão ficar aqui. */
export function AreaFechada({
  painel,
  resultado,
}: {
  readonly painel: PainelDaGarmin;
  readonly resultado: ResultadoDaAtualizacao | null;
}) {
  return (
    <>
      <h1>Você está dentro</h1>
      <p>Esta é a área fechada do {NOME_DO_APP}. As telas do app vão ficar aqui.</p>
      <PainelGarmin painel={painel} resultado={resultado} />
    </>
  );
}
