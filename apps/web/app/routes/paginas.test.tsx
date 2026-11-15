import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { EMAIL_DE_CONTATO, POLITICA_ATUALIZADA_EM } from "../config";
import Area from "./app";
import Inicio from "./inicio";
import Privacidade from "./privacidade";

const html = (elemento: React.ReactElement) =>
  renderToStaticMarkup(<MemoryRouter>{elemento}</MemoryRouter>);
const textoVisivel = (marcacao: string) => marcacao.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const PALAVRAS_PROIBIDAS = [/improdutiv/i, /\bruim\b/i, /\bvoc[êe] deve\b/i, /\btreine\b/i];

describe("política de privacidade", () => {
  const marcacao = html(<Privacidade />);
  const texto = textoVisivel(marcacao);

  it("tem as 10 seções da decisão 0007, em ordem", () => {
    const titulos = [...marcacao.matchAll(/<h2 id="secao-(\d+)">(\d+)\. ([^<]+)<\/h2>/g)];
    expect(titulos.map((t) => Number(t[1]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(titulos.map((t) => Number(t[2]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(titulos.map((t) => t[3])).toEqual([
      "Quais dados",
      "Para quê",
      "Base legal",
      "Onde os dados ficam",
      "Inteligência artificial",
      "Credenciais da Garmin",
      "Seus direitos",
      "Compartilhamento",
      "Aviso de responsabilidade",
      "Contato e atualizações",
    ]);
  });

  it("traz o e-mail do projeto, como único identificador do responsável", () => {
    expect(texto).toContain(EMAIL_DE_CONTATO);
    expect(marcacao).toContain(`mailto:${EMAIL_DE_CONTATO}`);
  });

  it("traz a data da última atualização, legível e em formato de máquina", () => {
    expect(texto).toContain(POLITICA_ATUALIZADA_EM.porExtenso);
    expect(marcacao).toContain(`<time dateTime="${POLITICA_ATUALIZADA_EM.iso}">`);
  });

  it("diz a idade mínima e a exclusão imediata", () => {
    expect(texto).toContain("maiores de 18 anos");
    expect(texto).toMatch(/apagamos todos os seus dados imediatamente/);
  });

  it("diz a verdade da etapa 1: sem coleta de visitante, sem cookies nas páginas públicas, sem dados de saúde", () => {
    expect(texto).toMatch(/não coleta dados de quem o visita/);
    expect(texto).toMatch(/não usam cookies, rastreadores nem análise de uso/);
    expect(texto).toMatch(/ainda não trata dados de saúde/);
  });

  it("marca como 'Ainda não ativo' as partes que dependem do conector Garmin", () => {
    const marcas = marcacao.match(/Ainda não ativo<\/p>/g) ?? [];
    // Seções 1, 2, 3, 4, 5, 6, 7 e 8.
    expect(marcas).toHaveLength(8);
  });

  it("mantém o compromisso da IA, da chave Garmin e do consentimento", () => {
    expect(texto).toMatch(/sem seu nome nem\s+seu e-mail/);
    expect(texto).toMatch(/nunca é gravada em banco de dados/);
    expect(texto).toMatch(/consentimento específico e destacado/);
  });

  it("não identifica o responsável por nome (decisão do dono)", () => {
    expect(texto).not.toMatch(/\bCPF\b|\bCNPJ\b/i);
  });

  it("não usa linguagem que julga ou prescreve", () => {
    for (const proibida of PALAVRAS_PROIBIDAS) {
      expect(texto).not.toMatch(proibida);
    }
  });
});

describe("página inicial", () => {
  const marcacao = html(<Inicio />);
  const texto = textoVisivel(marcacao);

  it("explica o app nos três ângulos da decisão 0001", () => {
    expect(texto).toContain("O porquê");
    expect(texto).toContain("Você contra você");
    expect(texto).toContain("Tradutor do seu relógio");
  });

  it("diz que descreve e estima, sem recomendar treino, e que está em fase fechada", () => {
    expect(texto).toMatch(/descreve e estima/);
    expect(texto).toMatch(/não recomenda treino, não\s+prescreve e não julga/);
    expect(texto).toMatch(/fase fechada/);
  });

  it("liga para a política e para o e-mail de contato", () => {
    expect(marcacao).toContain('href="/privacidade"');
    expect(marcacao).toContain(`mailto:${EMAIL_DE_CONTATO}`);
  });

  it("não usa a palavra Garmin no nome do produto: só como fonte de dados", () => {
    expect(texto).not.toMatch(/Garmin\s+Atleta|Atleta\s+Garmin/i);
    expect(texto).toMatch(/conta Garmin/);
  });

  it("não usa linguagem que julga ou prescreve", () => {
    for (const proibida of PALAVRAS_PROIBIDAS) {
      expect(texto).not.toMatch(proibida);
    }
  });
});

describe("área fechada", () => {
  it("mostra 'Você está dentro'", () => {
    expect(textoVisivel(html(<Area />))).toContain("Você está dentro");
  });
});
