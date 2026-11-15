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
      "Para quê e por quanto tempo",
      "Por que podemos usar seus dados (base legal)",
      "Onde os dados ficam e como são protegidos",
      "Inteligência artificial",
      "Sua conta Garmin",
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

  it("diz a idade mínima (18 anos ou mais) e a exclusão imediata dos dados do app", () => {
    expect(texto).toContain("pessoas com 18 anos ou mais");
    expect(texto).not.toContain("maiores de 18");
    expect(texto).toMatch(/apagamos seus dados do app imediatamente/);
  });

  it("não promete apagar tudo de imediato: cópias de segurança podem levar um tempo", () => {
    expect(texto).not.toMatch(/apagamos todos os seus dados imediatamente/);
    expect(texto).toMatch(/Cópias de segurança mantidas pela infraestrutura podem levar um tempo/);
  });

  it("diz a verdade da etapa 1: sem coleta de visitante, sem cookies nas páginas públicas, sem dados de saúde", () => {
    expect(texto).toMatch(/não coleta dados de quem o visita/);
    expect(texto).toMatch(/não definem cookies e não têm rastreadores nem análise de uso/);
    expect(texto).toMatch(/ainda não trata dados de saúde/);
  });

  it("diz que os registros de funcionamento do site estão desligados", () => {
    expect(texto).toMatch(/registros de\s+funcionamento do site estão desligados/);
    expect(texto).toMatch(/o projeto não guarda registros de quem o visita/);
  });

  it("lista os direitos do artigo 18 da LGPD e a reclamação à ANPD", () => {
    expect(texto).toContain("Pelo artigo 18 da LGPD, você pode pedir");
    for (const direito of [
      /confirmação de que tratamos dados seus/,
      /acesso aos seus dados/,
      /correção de dados incompletos, errados ou desatualizados/,
      /anonimização, bloqueio ou eliminação de dados desnecessários/,
      /portabilidade dos seus dados/,
      /eliminação dos dados tratados com o seu consentimento/,
      /com quais entidades compartilhamos/,
      /possibilidade de não dar o consentimento e suas consequências/,
      /revogação do consentimento, a qualquer momento/,
      /reclamação à Autoridade Nacional de Proteção de Dados \(ANPD\)/,
    ]) {
      expect(texto).toMatch(direito);
    }
    expect(marcacao.match(/<li>/g) ?? []).toHaveLength(9);
  });

  it("diz por quanto tempo os dados ficam, como são protegidos e como o titular é avisado de incidente", () => {
    expect(texto).toMatch(/ficam guardados enquanto a sua conta estiver conectada/);
    expect(texto).toMatch(/Como vamos protegê-los/);
    expect(texto).toMatch(
      /incidente de segurança que possa trazer risco ou dano a você, avisamos você e a Autoridade Nacional/,
    );
  });

  it("evita jargão que o atleta não conhece (token, logs, criptografado)", () => {
    expect(texto).not.toMatch(/\btokens?\b/i);
    expect(texto).not.toMatch(/\blogs?\b/i);
    expect(texto).not.toMatch(/criptografad/i);
    // "criptografia" só aparece explicada em palavras simples.
    expect(texto).toMatch(/embaralhada, o que se chama criptografia/);
  });

  it("não fala em Cloudflare Access de um jeito que sugira cookie nas páginas públicas", () => {
    expect(texto).toMatch(/só nessa área,\s+um cookie de sessão/);
  });

  it("marca como 'Ainda não ativo' as partes que dependem do conector Garmin", () => {
    const marcas = marcacao.match(/Ainda não ativo<\/p>/g) ?? [];
    // Seções 1, 2, 3, 4, 5, 6, 7 e 8.
    expect(marcas).toHaveLength(8);
  });

  it("mantém o compromisso da IA, da chave Garmin e do consentimento", () => {
    expect(texto).toMatch(/sem seu nome nem\s+seu e-mail/);
    expect(texto).toMatch(/nunca é gravada em banco de\s+dados/);
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

  it("explica em linguagem simples os termos da Garmin que cita", () => {
    expect(texto).toMatch(/Training Status \(como está o seu\s+treino\)/);
    expect(texto).toMatch(/Training Effect \(o efeito de um treino/);
    expect(texto).toMatch(/Body\s+Battery \(a sua energia ao longo do dia\)/);
    expect(texto).toMatch(/HRV Status \(como varia o tempo entre um\s+batimento e outro/);
  });

  it("não fala como se o app já funcionasse: o que oferece está no futuro", () => {
    expect(texto).toMatch(/está sendo feito para pegar/);
    expect(texto).toMatch(/Cada número vai responder/);
    expect(texto).toMatch(/ainda não funciona para o público/);
    expect(texto).not.toMatch(/O Sou Atleta pega os dados/);
    expect(texto).not.toMatch(/Cada número responde/);
  });

  it("diz que descreve e estima, sem recomendar treino, e que está em fase fechada", () => {
    expect(texto).toMatch(/descreve e estima/);
    expect(texto).toMatch(/Como está hoje/);
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
