import { NOME_DO_APP } from "../config";

export function meta() {
  return [{ title: `Área fechada · ${NOME_DO_APP}` }, { name: "robots", content: "noindex" }];
}

/** Tela de teste da área fechada: prova que só quem tem acesso chega até aqui. */
export default function Area() {
  return (
    <>
      <h1>Você está dentro</h1>
      <p>Esta é a área fechada do {NOME_DO_APP}. As telas do app vão ficar aqui.</p>
    </>
  );
}
