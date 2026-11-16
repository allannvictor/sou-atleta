import { NOME_DO_APP } from "../config";
import type { PainelDaGarmin, ResultadoDaAtualizacao } from "../server/garmin";
import type { MomentoAtual } from "../server/momento-atual";
import { MomentoAtualQuadro } from "./momento-atual";
import { PainelGarmin } from "./painel-garmin";

/** Conteúdo da área fechada: só quem tem acesso chega até aqui. As telas do app vão ficar aqui. */
export function AreaFechada({
  painel,
  resultado,
  buscaPedida = false,
  momento = { situacao: "indisponivel" },
}: {
  readonly painel: PainelDaGarmin;
  readonly resultado: ResultadoDaAtualizacao | null;
  /** A abertura da página acabou de pedir uma sincronização. */
  readonly buscaPedida?: boolean;
  readonly momento?: MomentoAtual;
}) {
  return (
    <>
      <h1>Você está dentro</h1>
      <p>Esta é a área fechada do {NOME_DO_APP}. As telas do app vão ficar aqui.</p>
      <p>
        <a href="/app/conta">Sua conta: sair, desconectar a Garmin ou apagar tudo</a>
      </p>
      <MomentoAtualQuadro momento={momento} />
      <PainelGarmin painel={painel} resultado={resultado} buscaPedida={buscaPedida} />
    </>
  );
}
