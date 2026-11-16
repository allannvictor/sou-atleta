import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { EMAIL_DE_CONTATO, POLITICA_ATUALIZADA_EM } from "../config";
import { AreaFechada } from "../componentes/area-fechada";
import { montarPainel } from "../server/garmin";
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

  it("diz a idade mínima (18 anos ou mais), apaga os dados de menores e diz como avisar", () => {
    expect(texto).toContain("pessoas com 18 anos ou mais");
    expect(texto).not.toContain("maiores de 18");
    expect(texto).toContain(
      "Se soubermos que alguém com menos de 18 anos se cadastrou, apagamos os dados.",
    );
    expect(texto).toMatch(
      /Se você é responsável por uma pessoa com menos de 18 anos que se cadastrou, ou sabe de um caso assim, escreva para souatletaapp@gmail\.com e apagamos os dados dessa pessoa/,
    );
  });

  it("separa sair, desconectar a Garmin e apagar a conta (issue #21)", () => {
    expect(texto).toMatch(/Sair Só encerra a sua sessão\. Nunca apaga dados\./);
    expect(texto).toMatch(
      /Desconectar a Garmin Interrompe a sincronização e apaga a chave de acesso, mas mantém o histórico que já veio da Garmin, para você retomar de onde parou se reconectar/,
    );
    expect(texto).toMatch(/Apagar minha conta Apaga todos os seus dados no app, na hora\./);
    // A frase antiga misturava sair e desconectar e prometia apagar tudo.
    expect(texto).not.toMatch(/desconectar ou sair/i);
    expect(texto).not.toMatch(/apagada quando você desconectar\b(?! a Garmin)/);
    expect(texto).not.toMatch(/apagamos seus dados do app imediatamente/);
  });

  it("quem desconecta fica sabendo como apagar o histórico", () => {
    expect(texto).toContain("Para apagar esse histórico, use “Apagar minha conta”.");
  });

  it("explica que revogar na Garmin não é uma ação do app", () => {
    expect(texto).toMatch(
      /Se você tirar a permissão pelo site ou pelo app da Garmin, o efeito é o mesmo/,
    );
    expect(texto).toMatch(
      /Isso não é uma ação do Sou Atleta: é uma configuração que fica na sua conta Garmin/,
    );
    expect(texto).not.toMatch(/revogar o acesso na própria Garmin/);
  });

  it("não afirma no presente que a Garmin é avisada: é etapa futura", () => {
    expect(texto).not.toMatch(/Também avisamos a Garmin/i);
    expect(texto).toMatch(
      /Na etapa seguinte \(ainda não ativa\), também avisaremos a Garmin de que você desconectou/,
    );
  });

  it("deixa claro que nada é apagado na Garmin: o app só guarda uma cópia", () => {
    expect(texto).toMatch(
      /Nada disso apaga algo na Garmin: o app só guarda uma cópia dos seus dados/,
    );
  });

  it("diz que os dados ficam até apagar a conta ou 24 meses sem uso, e que uso é entrar no app", () => {
    expect(texto).toMatch(
      /Seus dados ficam guardados até você usar “Apagar minha conta” ou até 24 meses sem uso/,
    );
    expect(texto).toContain("Conta como uso entrar no app; a sincronização automática não conta.");
    expect(texto).toMatch(/Antes de apagar por falta de uso, avisamos você por e-mail/);
    expect(texto).not.toMatch(/ficam guardados enquanto a sua conta estiver conectada/);
  });

  it("cita o e-mail usado para entrar, só para avisos sobre a conta", () => {
    expect(texto).toMatch(
      /guardaremos o e-mail que você usar para entrar, só para avisos sobre a sua conta/,
    );
    expect(texto).toMatch(/Não usamos esse e-mail para publicidade/);
  });

  it("revogar o consentimento apaga a conta, e o pedido por e-mail é tratado como apagar a conta", () => {
    expect(texto).toMatch(/Você pode revogar \(retirar\) o seu consentimento a qualquer momento/);
    expect(texto).toMatch(/Se você revogar, paramos de usar os seus dados e apagamos a sua conta/);
    expect(texto).toMatch(
      /Se você pedir por e-mail para revogar o consentimento ou o acesso, tratamos o pedido como “Apagar minha conta”: apagamos tudo no app em até 15 dias e avisamos você por e-mail quando terminar/,
    );
  });

  it("promete resposta em até 15 dias para pedidos por e-mail, ou antes se a lei exigir prazo menor", () => {
    expect(texto).toContain(
      "Quando você pedir por e-mail, respondemos em até 15 dias, ou antes, se a lei exigir prazo menor.",
    );
    expect(texto).not.toMatch(/Respondemos nos prazos que a lei prevê/);
  });

  it("apagar a conta apaga no app, na hora, e a ressalva das cópias de segurança (até 7 dias) vem junto", () => {
    expect(texto).not.toMatch(/apagamos todos os seus dados imediatamente/);
    expect(texto).toMatch(
      /Apaga todos os seus dados no app, na hora\. Não dá para desfazer; por isso, antes de apagar, você poderá baixar uma cópia dos seus dados\. Cópias de segurança mantidas pela infraestrutura podem levar até 7 dias para sumir por completo/,
    );
    expect(texto).not.toMatch(/prazo exato será\s+informado/);
  });

  it("cópias de segurança somem em até 7 dias (plano gratuito do D1), não mais 30", () => {
    expect(texto).toMatch(/podem levar até 7 dias para sumir por completo/);
    expect(texto).not.toMatch(/30 dias/);
  });

  it("diz que só a rotina de sincronização guarda registros: eventos, por 3 dias, sem segredo nem saúde", () => {
    expect(texto).toMatch(/Registros de funcionamento da sincronização\./);
    expect(texto).toMatch(
      /guardar registros de funcionamento no serviço de registros da Cloudflare, por 3 dias/,
    );
    expect(texto).toMatch(/dizem só o que aconteceu/);
    expect(texto).toMatch(
      /Nunca levam a sua chave de acesso, a autorização temporária que a Garmin entrega em troca dela, nem dados de saúde/,
    );
    expect(texto).toMatch(/o site que você vê continua sem registros/);
    // O Resumo avisa, com link para a seção 4.
    const resumo = marcacao.slice(
      marcacao.indexOf('class="resumo"'),
      marcacao.indexOf('id="secao-1"'),
    );
    expect(resumo).toMatch(/registros de eventos técnicos, por 3 dias/);
    expect(resumo).toContain('href="#secao-4"');
  });

  it("a data da política é a desta revisão (16 de novembro de 2026)", () => {
    expect(POLITICA_ATUALIZADA_EM.iso).toBe("2026-11-16");
    expect(texto).toContain("16 de novembro de 2026");
  });

  it("explica os termos difíceis na primeira vez em que aparecem", () => {
    expect(texto.search(/sessão/)).toBeGreaterThan(-1);
    expect(texto.search(/sessão/)).toBe(texto.search(/sessão, isto é, fecha o seu acesso/));
    expect(texto.search(/sincronização/)).toBe(
      texto.search(/sincronização \(o app deixa de buscar dados novos na Garmin\)/),
    );
    expect(texto.search(/chave de acesso/)).toBe(
      texto.search(/chave de acesso \(a autorização que a Garmin deu ao app, sem a sua senha\)/),
    );
    expect(texto).not.toMatch(/importado/i);
  });

  it("traz no Resumo o quadro das três ações, com link para a seção 7", () => {
    const resumo = marcacao.slice(
      marcacao.indexOf('class="resumo"'),
      marcacao.indexOf('id="secao-1"'),
    );
    expect(resumo).toContain('href="#secao-7"');
    expect(resumo).toContain("<dt>Sair</dt>");
    expect(resumo).toContain("<dt>Desconectar a Garmin</dt>");
    expect(resumo).toContain("<dt>Apagar minha conta</dt>");
  });

  it("usa links nas referências a outras seções", () => {
    expect(texto).not.toMatch(/\bseções? \d/);
    for (const n of [5, 6, 7]) {
      expect(marcacao).toContain(`href="#secao-${String(n)}"`);
    }
  });

  it("usa o mesmo par de nomes: Conectar a Garmin e Desconectar a Garmin", () => {
    expect(texto).toContain("“Conectar a Garmin”");
    expect(texto).not.toMatch(/Conectar com Garmin/);
  });

  it("diz a verdade da etapa 1: sem coleta de visitante, sem cookies nas páginas públicas, sem dados de saúde", () => {
    expect(texto).toMatch(/não coleta dados de quem o visita/);
    expect(texto).toMatch(/não define cookies e não tem rastreadores nem análise de uso/);
    expect(texto).toMatch(/ainda não trata dados de saúde/);
  });

  it("diz que os registros de funcionamento do site estão desligados", () => {
    expect(texto).toMatch(/registros de\s+funcionamento desligados/);
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
    const lista = /<ul[^>]*aria-label="Direitos do artigo 18 da LGPD">(.*?)<\/ul>/s.exec(marcacao);
    expect(lista?.[1]?.match(/<li>/g) ?? []).toHaveLength(9);
  });

  it("diz por quanto tempo os dados ficam, como são protegidos e como o titular é avisado de incidente", () => {
    expect(texto).toMatch(/Seus dados ficam guardados até você usar/);
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
    const marcas = marcacao.match(/<p class="etiqueta">Ainda não ativo</g) ?? [];
    // Resumo (quadro das três ações) e seções 1, 2, 3, 4, 5, 6, 7 e 8.
    expect(marcas).toHaveLength(9);
  });

  it("a etiqueta 'Ainda não ativo' diz ao leitor de tela até onde vale", () => {
    expect(marcacao).toContain(
      '<span class="so-leitor">: o texto a seguir, até o fim desta parte, descreve uma etapa futura.</span>',
    );
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
    expect(
      textoVisivel(
        html(<AreaFechada painel={montarPainel(null, new Date(), false)} resultado={null} />),
      ),
    ).toContain("Você está dentro");
  });
});
