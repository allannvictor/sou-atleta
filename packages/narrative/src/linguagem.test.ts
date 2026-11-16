import { describe, expect, it } from "vitest";

import { frasesLongas, verificarLinguagem } from "./linguagem.js";

describe("checagem de linguagem", () => {
  it.each([
    "Descanse mais esta semana.",
    "Você deveria treinar menos.",
    "Seu treino foi ruim.",
    "Ótimo trabalho!",
    "Há risco de lesão.",
    "Fique em alerta com a sua carga.",
    "Recomendamos um dia de folga.",
    "O ideal é correr devagar.",
    "Seu ritmo está melhor que o do mês passado.",
    "Isso é preocupante.",
    "Procure um médico.",
  ])("reprova: %s", (texto) => {
    expect(verificarLinguagem(texto).length).toBeGreaterThan(0);
  });

  it.each([
    "Sua Base está em 42. Está 8% acima de 7 dias atrás.",
    "Seu Saldo está em -10: sua Carga recente está acima da sua Base.",
    "Conhecendo você: faltam 9 dias de dados.",
    "Sua carga dos últimos 7 dias foi 600, 20% acima da sua média das 6 semanas anteriores.",
    "Seu HRV está dentro do seu normal.",
  ])("aprova: %s", (texto) => {
    expect(verificarLinguagem(texto)).toEqual([]);
  });

  it("não confunde palavras que só contêm o termo ('bombeiro', 'precisão')", () => {
    expect(verificarLinguagem("A precisão do sensor de pulso varia.")).toEqual([]);
    expect(verificarLinguagem("Corrida de bombeiros.")).toEqual([]);
  });

  it("aponta o trecho e o motivo", () => {
    const problema = verificarLinguagem("Seu treino foi ruim.")[0];
    expect(problema?.trecho).toBe("ruim");
    expect(problema?.motivo).toContain("julga");
  });

  it("acha frases longas demais", () => {
    const longa = Array<string>(30).fill("palavra").join(" ") + ".";
    expect(frasesLongas(`Curta. ${longa}`)).toHaveLength(1);
    expect(frasesLongas("Curta. Outra curta.")).toEqual([]);
  });
});
