import { readFileSync } from "node:fs";

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
  /** Texto visível de uma seção (`numero` de 1 a 10). */
  const secao = (numero: number) => {
    const inicio = marcacao.indexOf(`id="secao-${String(numero)}"`);
    const fim =
      numero === 10 ? marcacao.length : marcacao.indexOf(`id="secao-${String(numero + 1)}"`);
    return textoVisivel(marcacao.slice(inicio, fim));
  };
  const resumo = marcacao.slice(
    marcacao.indexOf('class="resumo"'),
    marcacao.indexOf('id="secao-1"'),
  );
  /** O trecho aparece só depois da etiqueta "Ainda não ativo" daquela seção. */
  const soNoFuturo = (trechoDaSecao: string, trecho: RegExp) => {
    const etiqueta = trechoDaSecao.indexOf("Ainda não ativo");
    const achado = trechoDaSecao.search(trecho);
    expect(achado, String(trecho)).toBeGreaterThan(-1);
    expect(etiqueta, "etiqueta Ainda não ativo").toBeGreaterThan(-1);
    expect(achado, String(trecho)).toBeGreaterThan(etiqueta);
  };

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

  it("a data da política é a da revisão do conector ativo (issue #29)", () => {
    expect(POLITICA_ATUALIZADA_EM.iso).toBe("2026-11-17");
    expect(texto).toContain("17 de novembro de 2026");
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

  it("diz a verdade da etapa 1: só o responsável pelo projeto, com os próprios dados de saúde", () => {
    expect(texto).toMatch(/não coleta dados de quem o visita/);
    expect(texto).toMatch(/não define cookies e não tem rastreadores nem análise de uso/);
    expect(texto).toMatch(/trata dados de saúde de uma única pessoa: o responsável pelo projeto/);
    expect(texto).toMatch(/Mais ninguém usa o app nesta fase/);
  });

  it("não traz mais frases que ficaram falsas com o conector ativo", () => {
    for (const falsa of [
      /ainda não trata dados de saúde/,
      /ainda não está conectado/,
      /não há o que apagar/,
      /não guarda dados seus/,
      /Hoje não existe nenhuma conexão com a Garmin/,
      /atividades de corrida/,
      /30 dias/,
    ]) {
      expect(texto).not.toMatch(falsa);
    }
  });

  it("lista os dados que vêm da Garmin, de todas as modalidades, e o que não guarda", () => {
    const s1 = secao(1);
    for (const dado of [
      /atividades de todas as modalidades/,
      /data e hora de início, tipo, duração, distância/,
      /se a FC veio do pulso ou de uma cinta/,
      /tempo em cada zona de FC, VO2max \(a estimativa da Garmin/,
      /e Training Effect/,
      /variabilidade da frequência cardíaca \(HRV\) da noite/,
      /sono: tempo total, tempo em cada fase e tempo acordado/,
      /FC de repouso \(e se veio do pulso ou de uma cinta\), estresse e Body\s+Battery/,
      /zonas de FC de cada esporte, o método e os valores usados para elas/,
      /sistema de medidas, fuso horário e dias preferidos/,
      /revelam a região aproximada/,
      /não guarda o trajeto de GPS, a localização exata, o seu nome, o seu e-mail, a sua foto, a senha da Garmin nem a chave de acesso/,
      /informações técnicas da própria sincronização/,
      /só os últimos 90 dias/,
      /só quando você abre o app ou toca em “Atualizar agora”/,
    ]) {
      expect(s1).toMatch(dado);
    }
  });

  it("toda coluna de dado das migrações aparece na seção 1 (dado novo precisa entrar na política)", () => {
    const pasta = new URL("../../../../packages/db/migrations/", import.meta.url);
    const sql = readFileSync(new URL("0000_inicial.sql", pasta), "utf8");
    const colunas = [...sql.matchAll(/CREATE TABLE `(\w+)` \(([\s\S]*?)\n\);/g)].flatMap(
      ([, tabela, corpo]) =>
        [...(corpo ?? "").matchAll(/^\s*`(\w+)`/gm)].map(
          ([, coluna]) => `${tabela ?? ""}.${coluna ?? ""}`,
        ),
    );
    expect(colunas.length).toBeGreaterThan(40);
    const tecnica = /informações técnicas da própria sincronização/;
    // Onde cada coluna aparece na seção 1. Colunas de controle (id, fonte, horários de gravação)
    // são a parte "informações técnicas".
    const ondeAparece: Record<string, RegExp> = {
      id: tecnica,
      fonte: tecnica,
      atualizado_em: tecnica,
      data: /da noite|sono:|resumo do dia/,
      data_local: /data e hora de início/,
      inicio_local: /data e hora de início/,
      inicio_gmt: /data e hora de início/,
      tipo: /tipo, duração/,
      duracao_s: /duração/,
      distancia_m: /distância/,
      fc_media: /\(FC\) média e máxima/,
      fc_maxima: /\(FC\) média e máxima|FC máxima/,
      fc_origem: /se a FC veio do pulso ou de uma cinta/,
      fc_origem_conferida: /se a FC veio do pulso ou de uma cinta/,
      tempo_zona1_s: /tempo em cada zona de FC/,
      tempo_zona2_s: /tempo em cada zona de FC/,
      tempo_zona3_s: /tempo em cada zona de FC/,
      tempo_zona4_s: /tempo em cada zona de FC/,
      tempo_zona5_s: /tempo em cada zona de FC/,
      vo2max: /VO2max/,
      efeito_aerobico: /Training Effect/,
      efeito_anaerobico: /Training Effect/,
      hrv_noite_ms: /\(HRV\) da noite/,
      hrv_semana_ms: /e da semana/,
      hrv_pico_5min_ms: /o maior valor em 5 minutos/,
      estado: /o estado dela segundo a Garmin/,
      sono_s: /sono: tempo total/,
      profundo_s: /tempo em cada fase/,
      leve_s: /tempo em cada fase/,
      rem_s: /tempo em cada fase/,
      acordado_s: /tempo acordado/,
      fc_repouso: /FC de repouso/,
      fc_repouso_origem: /FC de repouso \(e se veio do pulso ou de uma cinta\)/,
      estresse_medio: /estresse/,
      estresse_maximo: /estresse/,
      body_battery_min: /Body\s+Battery/,
      body_battery_max: /Body\s+Battery/,
      body_battery_carregada: /Body\s+Battery/,
      body_battery_drenada: /Body\s+Battery/,
      body_battery_fim_do_dia: /Body\s+Battery/,
      esporte: /zonas de FC de cada esporte/,
      metodo: /o método/,
      fc_limiar: /de limiar/,
      zona1_piso: /zonas de FC de cada esporte/,
      zona2_piso: /zonas de FC de cada esporte/,
      zona3_piso: /zonas de FC de cada esporte/,
      zona4_piso: /zonas de FC de cada esporte/,
      zona5_piso: /zonas de FC de cada esporte/,
      sistema_de_medidas: /sistema de medidas/,
      fuso_horario: /fuso horário/,
      dias_disponiveis: /dias preferidos para treinar/,
      dias_longos: /para treinos longos/,
      fluxo: /até que dia os dados já vieram/,
      inicio: /até que dia os dados já vieram/,
      importado_ate: /até que dia os dados já vieram/,
      historico_completo: /até que dia os dados já vieram/,
      verificado_em: /quando ela rodou/,
      status_da_chave: /códigos curtos de erro/,
      chave_vence_em: /a data de vencimento da chave/,
      erro_codigo: /códigos curtos de erro/,
      ultima_execucao_em: /quando ela rodou/,
      ultimo_sucesso_em: /quando ela rodou/,
      pausa_ate: /quando ela rodou/,
      falhas_de_limite_seguidas: /códigos curtos de erro/,
      itens_ignorados: /códigos curtos de erro/,
      trava_ate: /quando ela rodou/,
    };
    const s1 = secao(1);
    for (const coluna of colunas) {
      const nome = coluna.split(".")[1] ?? "";
      const padrao = ondeAparece[nome];
      expect(padrao, `coluna ${coluna} sem frase na política`).toBeDefined();
      if (padrao !== undefined) expect(s1, coluna).toMatch(padrao);
    }
  });

  it("o e-mail para avisos e os 24 meses sem uso são etapa futura", () => {
    soNoFuturo(
      secao(1),
      /guardaremos o e-mail que você usar para entrar, só para avisos sobre a sua conta/,
    );
    expect(secao(1)).toMatch(/Não usamos esse e-mail para publicidade/);
    expect(secao(2)).toMatch(/Seus dados ficam guardados até você usar “Apagar minha conta”\./);
    soNoFuturo(secao(2), /24 meses sem uso/);
    soNoFuturo(secao(2), /avisaremos você por e-mail/);
  });

  it("base legal: sem tela de consentimento na etapa 1; ela vem antes de qualquer outra pessoa", () => {
    expect(secao(3)).toMatch(
      /Ainda não existe tela de consentimento, porque ninguém mais usa o app/,
    );
    soNoFuturo(secao(3), /consentimento específico e destacado/);
    soNoFuturo(secao(3), /Antes de qualquer outra pessoa usar o app/);
    expect(secao(3)).toMatch(/o tratamento acontece por decisão do próprio titular/);
    expect(texto).toMatch(/Você pode revogar \(retirar\) essa decisão a qualquer momento/);
    expect(texto).toMatch(/Se você revogar, paramos de usar os seus dados e apagamos a sua conta/);
  });

  it("diz onde os dados ficam: fora do Brasil, na América do Norte (transferência internacional)", () => {
    expect(secao(4)).toMatch(/fora do Brasil/);
    expect(secao(4)).toMatch(/na América do Norte\. O país exato é escolhido pela\s+Cloudflare/);
    expect(secao(4)).toMatch(/transferência internacional de dados/);
  });

  it("registros da sincronização: eventos, por 3 dias, sem segredo nem saúde", () => {
    expect(texto).toMatch(/Registros de funcionamento da sincronização\./);
    expect(texto).toMatch(
      /guarda registros de funcionamento no serviço de registros da Cloudflare, por 3 dias/,
    );
    expect(texto).toMatch(/dizem só o que aconteceu/);
    expect(texto).toMatch(/um pedaço dos seus dados chegou da Garmin/);
    expect(texto).toMatch(
      /Nunca levam a sua chave de acesso, a autorização temporária que a Garmin entrega em troca dela, nem dados de saúde/,
    );
    expect(texto).toMatch(/a própria Cloudflare também pode registrá-lo/);
    expect(texto).toMatch(/o site que você vê continua sem registros/);
    expect(resumo).toMatch(/registros de eventos técnicos, por 3\s+dias/);
    expect(resumo).toContain('href="#secao-4"');
  });

  it("registros de entrada do Cloudflare Access: e-mail, IP e país, por 24 horas", () => {
    expect(texto).toMatch(
      /O Cloudflare Access registra cada entrada na área fechada: o e-mail, o endereço de internet \(IP\) e o país/,
    );
    expect(texto).toMatch(/guarda esses registros por 24 horas/);
    expect(resumo).toMatch(/cada entrada, por 24 horas/);
  });

  it("diz que o login pode ser pelo Google, que vê a entrada mas não recebe dados de saúde", () => {
    expect(secao(1)).toMatch(/conta Google ou um código enviado por e-mail/);
    expect(secao(8)).toMatch(
      /o Google fica sabendo de cada entrada, mas não recebe dados de saúde/,
    );
    expect(texto).not.toMatch(/Os dados passam apenas pela Cloudflare/);
  });

  it("não afirma de forma absoluta que os registros não têm dados de saúde", () => {
    expect(resumo).toMatch(/feitos para não levar dados de saúde/);
    expect(texto).not.toMatch(/sem dados de saúde/);
    expect(texto).not.toMatch(/não têm dados de saúde/);
  });

  it("os prazos valem no plano gratuito; mudar de plano muda a política antes", () => {
    expect(texto).toMatch(
      /valem no plano gratuito da Cloudflare, que o projeto usa\. Se o plano mudar, esta política muda antes/,
    );
  });

  it("diz que os registros de funcionamento do site estão desligados", () => {
    expect(texto).toMatch(/registros de\s+funcionamento desligados/);
    expect(texto).toMatch(/o projeto não guarda registros de\s+quem o visita/);
  });

  it("separa sair, desconectar a Garmin e apagar a conta, na página Sua conta", () => {
    expect(texto).toMatch(/Sair Só encerra a sua sessão\. Nunca apaga dados\./);
    expect(texto).toMatch(
      /Desconectar a Garmin Interrompe a sincronização e a chave de acesso deixa de valer, mas mantém o histórico que já veio da Garmin, para você retomar de onde parou se reconectar/,
    );
    expect(texto).toMatch(/Apagar minha conta Apaga todos os seus dados no app, na hora\./);
    expect(texto).toMatch(/As três ficam na página “Sua conta”, dentro da área fechada/);
    expect(texto).not.toMatch(/desconectar ou sair/i);
  });

  it("desconectar, na etapa 1, são dois passos feitos pelo responsável", () => {
    expect(texto).toMatch(
      /Nesta fase, desconectar tem dois passos, feitos por você: apagar a chave no site da Garmin e removê-la do cofre do app/,
    );
    expect(texto).toMatch(/O app não consegue apagá-la sozinho/);
    expect(texto).toMatch(
      /Na etapa seguinte \(ainda não ativa\), desconectar será um botão, e também avisaremos a Garmin de que você desconectou/,
    );
    expect(texto).not.toMatch(/Também avisamos a Garmin/i);
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
  });

  it("apagar exige a Garmin desconectada e diz o que não é apagado, com os prazos", () => {
    expect(texto).toMatch(
      /Apaga todos os seus dados no app, na hora\. Não dá para desfazer\. Para apagar, a chave da Garmin tem de já ter saído do cofre do app/,
    );
    expect(texto).toMatch(/os registros de entrada do Cloudflare Access, que somem em 24 horas/);
    expect(texto).toMatch(
      /os registros da sincronização, que somem em até 3 dias e são feitos para não levar dados de saúde/,
    );
    expect(texto).toMatch(/podem levar até 7 dias para sumir por completo/);
  });

  it("ver e baixar os dados é etapa futura (não é prometido antes de apagar hoje)", () => {
    soNoFuturo(secao(7), /você poderá ver e baixar uma cópia de todos os seus dados/);
    expect(texto).not.toMatch(/por isso, antes de apagar, você poderá baixar/);
  });

  it("deixa claro que nada é apagado na Garmin: o app só guarda uma cópia", () => {
    expect(texto).toMatch(
      /Nada disso apaga algo na Garmin: o app só guarda uma cópia dos seus dados/,
    );
  });

  it("o pedido por e-mail é tratado como apagar a conta", () => {
    expect(texto).toMatch(
      /Se você pedir por e-mail para revogar o consentimento ou o acesso, tratamos o pedido como “Apagar minha conta”: apagamos tudo no app em até 15 dias e avisamos você por e-mail quando terminar/,
    );
  });

  it("promete resposta em até 15 dias para pedidos por e-mail, ou antes se a lei exigir prazo menor", () => {
    expect(texto).toContain(
      "Quando você pedir por e-mail, respondemos em até 15 dias, ou antes, se a lei exigir prazo menor.",
    );
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
    expect(texto).not.toMatch(/\blote\b/);
  });

  it("traz no Resumo o quadro das três ações, sem 'Ainda não ativo', com link para a seção 7", () => {
    expect(resumo).toContain('href="#secao-7"');
    expect(resumo).toContain("<dt>Sair</dt>");
    expect(resumo).toContain("<dt>Desconectar a Garmin</dt>");
    expect(resumo).toContain("<dt>Apagar minha conta</dt>");
    expect(resumo).not.toContain('class="etiqueta"');
  });

  it("usa links nas referências a outras seções", () => {
    expect(texto).not.toMatch(/\bseções? \d/);
    for (const n of [1, 4, 5, 6, 7]) {
      expect(marcacao).toContain(`href="#secao-${String(n)}"`);
    }
  });

  it("usa o mesmo par de nomes: Conectar a Garmin e Desconectar a Garmin", () => {
    expect(texto).toContain("“Conectar a Garmin”");
    expect(texto).not.toMatch(/Conectar com Garmin/);
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

  it("diz como os dados são protegidos e como o titular é avisado de incidente", () => {
    expect(texto).toMatch(/Como os protegemos/);
    expect(texto).toMatch(
      /incidente de segurança que possa trazer risco ou dano a você, avisamos você e a Autoridade Nacional/,
    );
  });

  it("evita jargão que o atleta não conhece (token, logs, criptografado)", () => {
    expect(texto).not.toMatch(/\btokens?\b/i);
    expect(texto).not.toMatch(/\blogs?\b/i);
    expect(texto).not.toMatch(/criptografad/i);
    expect(texto).toMatch(/embaralhada, o que se chama criptografia/);
  });

  it("não fala em Cloudflare Access de um jeito que sugira cookie nas páginas públicas", () => {
    expect(texto).toMatch(/só nessa área,\s+um cookie de sessão/);
  });

  it("marca como 'Ainda não ativo' só o que continua futuro", () => {
    const marcas = marcacao.match(/<p class="etiqueta">Ainda não ativo</g) ?? [];
    // Seções 1 (e-mail), 2 (24 meses), 3 (consentimento), 5 (IA), 6 (etapa 2), 7 (ver e baixar) e 8 (cards).
    expect(marcas).toHaveLength(7);
    expect(secao(4)).not.toContain("Ainda não ativo");
  });

  it("a etiqueta 'Ainda não ativo' diz ao leitor de tela até onde vale", () => {
    expect(marcacao).toContain(
      '<span class="so-leitor">: o texto a seguir, até o fim desta parte, descreve uma etapa futura.</span>',
    );
  });

  it("mantém o compromisso da IA e da chave Garmin", () => {
    expect(texto).toMatch(/sem seu nome nem\s+seu e-mail/);
    expect(texto).toMatch(/nunca é gravada em banco de\s+dados/);
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
