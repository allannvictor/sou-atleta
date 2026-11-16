import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MomentoAtual } from "../server/momento-atual";
import { MomentoAtualQuadro } from "./momento-atual";

const texto = (momento: MomentoAtual) =>
  renderToStaticMarkup(<MomentoAtualQuadro momento={momento} />)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");

describe("quadro Como você está", () => {
  it("sem dados, diz que os números aparecem quando os dados chegarem", () => {
    expect(texto({ situacao: "indisponivel" })).toContain(
      "Quando os seus dados da Garmin chegarem, os números aparecem aqui.",
    );
    expect(texto({ situacao: "sem_atividades", importacaoEmAndamento: true })).toContain(
      "Seus dados da Garmin ainda estão chegando.",
    );
  });

  it("com dados, mostra cartões, por que mudou, variação, volume e intensidade", () => {
    const t = texto({
      situacao: "pronto",
      importacaoEmAndamento: false,
      avisoDaImportacao: null,
      conhecendoABase: "Conhecendo você: faltam 9 dias de dados para sua Base ficar completa.",
      explicacaoDaCarga: "A carga mede quanto cada treino pesou.",
      cartoes: [
        { nome: "Base", valor: "42", explicacao: "Longo prazo.", frase: "Sua Base está em 42." },
      ],
      porQueMudou: [
        { texto: "10/11 · Corrida · 50 min · carga 132", aviso: "Estimativa simplificada." },
      ],
      treinosFora: null,
      variacao: "Sua carga dos últimos 7 dias foi 600.",
      semanas: [{ rotulo: "Semana de 09/11 (em andamento)", frase: "10,0 km de corrida." }],
      tendenciaDoVolume: [],
      conhecendoOVolume: "Conhecendo você: a tendência aparece depois de 8 semanas de dados.",
      intensidade: { frase: "Zona 2 (62%).", zonas: [{ zona: 2, percentual: 62 }] },
    });
    for (const trecho of [
      "Como você está",
      "Conhecendo você: faltam 9 dias",
      "Sua Base está em 42.",
      "Por que mudou?",
      "10/11 · Corrida · 50 min · carga 132",
      "(Estimativa simplificada.)",
      "Variação da carga",
      "Semana de 09/11 (em andamento):",
      "Zona 2 62%",
    ]) {
      expect(t).toContain(trecho);
    }
  });
});
