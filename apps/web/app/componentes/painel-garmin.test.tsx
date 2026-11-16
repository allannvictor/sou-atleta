import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { RESULTADOS_DA_ATUALIZACAO, type PainelDaGarmin } from "../server/garmin";
import { PainelGarmin } from "./painel-garmin";

const painelBase: PainelDaGarmin = {
  situacao: "pronta",
  aviso: null,
  chaveVenceEm: "2027-05-12",
  ultimaAtualizacaoEm: "2026-11-15T14:45:00.000Z",
  ultimaTentativaEm: "2026-11-15T14:50:00.000Z",
  importacao: { emAndamento: false, ate: "2026-11-15", parada: false },
  pausadaAte: null,
  problema: null,
  podeAtualizar: true,
};

type Resultado = Parameters<typeof PainelGarmin>[0]["resultado"];

const marcacao = (painel: PainelDaGarmin, resultado: Resultado = null, buscaPedida = false) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <PainelGarmin painel={painel} resultado={resultado} buscaPedida={buscaPedida} />
    </MemoryRouter>,
  );
const texto = (painel: PainelDaGarmin, resultado: Resultado = null, buscaPedida = false) =>
  marcacao(painel, resultado, buscaPedida)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");

describe("quadro da conta Garmin", () => {
  it("mostra o botão 'Atualizar agora', a última atualização e a última tentativa", () => {
    const t = texto(painelBase);
    expect(t).toContain("Atualizar agora");
    expect(t).toMatch(/Última atualização 15 de novembro de 2026 às? 11:45/);
    expect(t).toMatch(/Última tentativa 15 de novembro de 2026 às? 11:50 \. Funcionou\./);
    expect(t).toMatch(/Chave da Garmin Vence em 12 de maio de 2027 \./);
  });

  it("sem ligação com a sync, não mostra o botão", () => {
    expect(texto({ ...painelBase, podeAtualizar: false })).not.toContain("Atualizar agora");
  });

  it("o botão tem texto de ajuda ligado a ele e, sem JavaScript, funciona como formulário comum", () => {
    const m = marcacao(painelBase);
    expect(m).toContain('aria-describedby="ajuda-do-botao"');
    expect(m).toContain('id="ajuda-do-botao"');
    expect(m).toContain('method="post"');
    expect(m).toContain('aria-disabled="false"');
    expect(texto(painelBase)).toContain(
      "O app já busca dados novos sozinho quando você abre esta página. Use o botão se quiser adiantar.",
    );
    expect(texto(painelBase)).not.toContain("rotina de a cada");
  });

  it("chave vencida: diz o que fazer em passos curtos, inclusive atualizar a data de vencimento", () => {
    const m = marcacao({ ...painelBase, aviso: { tipo: "invalida", expirou: true } });
    const t = m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    expect(t).toContain("Sua chave da Garmin venceu em 12 de maio de 2027.");
    expect(t).toContain("O app continua abrindo com os dados já guardados");
    expect(t).toContain("Para voltar a sincronizar:");
    expect(t).toContain(
      "No Garmin Connect Web, gere uma chave nova da Personal API, com validade de 180 dias.",
    );
    expect(t).toContain("e a nova data de vencimento");
    expect(t).toMatch(/GARMIN_API_KEY/);
    expect(t).toMatch(/GARMIN_CHAVE_VENCE_EM/);
    expect(t).toContain("sou-atleta-sync");
    expect(t).toContain("Toque em “Atualizar agora” para conferir.");
    expect(m).toContain("<ol>");
    expect(m.match(/<li>/g)).toHaveLength(3);
  });

  it("chave recusada, vencida pela data, ausente e mal colada: todas trazem os passos", () => {
    for (const aviso of [
      { tipo: "invalida", expirou: false },
      { tipo: "venceu" },
      { tipo: "ausente" },
      { tipo: "mal_formada" },
    ] as const) {
      expect(texto({ ...painelBase, aviso }), aviso.tipo).toContain("Para voltar a sincronizar:");
    }
    expect(texto({ ...painelBase, aviso: { tipo: "venceu" } })).toContain(
      "Se você já gerou uma chave nova, falta atualizar também a data de vencimento",
    );
    expect(texto({ ...painelBase, aviso: { tipo: "invalida", expirou: false } })).toContain(
      "A Garmin recusou a chave",
    );
  });

  it("vence em N dias traz a data e o rótulo 'Aviso'; chave vencida traz 'Precisa de você'", () => {
    const vence = texto({
      ...painelBase,
      chaveVenceEm: "2026-11-29",
      aviso: { tipo: "vence", dias: 14 },
    });
    expect(vence).toContain("Sua chave da Garmin vence em 14 dias em 29 de novembro de 2026.");
    expect(vence).toContain("Aviso");
    expect(vence).not.toContain("Para voltar a sincronizar:");
    expect(texto({ ...painelBase, aviso: { tipo: "vence", dias: 1 } })).toContain("vence em 1 dia");
    expect(texto({ ...painelBase, aviso: { tipo: "vence", dias: 0 } })).toContain("vence hoje");
    expect(texto({ ...painelBase, aviso: { tipo: "invalida", expirou: true } })).toContain(
      "Precisa de você",
    );
  });

  it("vocabulário único da chave: nunca 'expirou' nem 'expirada'", () => {
    const todos = [
      { tipo: "invalida", expirou: true },
      { tipo: "invalida", expirou: false },
      { tipo: "venceu" },
      { tipo: "vence", dias: 3 },
      { tipo: "ausente" },
      { tipo: "mal_formada" },
      { tipo: "sem_data" },
    ] as const;
    for (const aviso of todos) {
      expect(texto({ ...painelBase, aviso }), aviso.tipo).not.toMatch(/expir/i);
    }
  });

  it("com a chave parada, não diz 'Trazendo': diz que a importação está parada e até onde foi", () => {
    const t = texto({
      ...painelBase,
      aviso: { tipo: "invalida", expirou: true },
      importacao: { emAndamento: true, ate: "2026-10-12", parada: true },
    });
    expect(t).toContain("A importação está parada até a chave funcionar. Já trouxemos até 12/10.");
    expect(t).not.toContain("Trazendo");
  });

  it("importação em andamento (chave boa): 'Trazendo seus últimos 3 meses: até 12/10'", () => {
    const t = texto({
      ...painelBase,
      importacao: { emAndamento: true, ate: "2026-10-12", parada: false },
    });
    expect(t).toContain("Trazendo seus últimos 3 meses: até 12/10.");
    expect(t).not.toContain("parada");
  });

  it("importação concluída: diz que os 3 meses chegaram e que daqui para a frente é só o novo", () => {
    expect(texto(painelBase)).toContain(
      "Já foram trazidos. Daqui para a frente o app busca só o que é novo.",
    );
  });

  it("problema do conector (token recusado): não manda gerar outra chave", () => {
    const t = texto({ ...painelBase, problema: "token_recusado" });
    expect(t).toContain("A Garmin aceitou a sua chave, mas recusou o acesso aos dados");
    expect(t).toContain("não gere outra chave por causa disso");
    expect(t).not.toContain("Para voltar a sincronizar:");
    expect(t).toContain("A Garmin aceitou a chave, mas recusou o acesso aos dados.");
  });

  it("a última tentativa diz como terminou, sem culpa", () => {
    expect(
      texto({
        ...painelBase,
        aviso: { tipo: "invalida", expirou: false },
        problema: "chave_invalida",
      }),
    ).toContain("A Garmin recusou a chave.");
    expect(texto({ ...painelBase, problema: "limite_garmin" })).toContain(
      "A Garmin pediu para esperar.",
    );
  });

  it("primeira vez: nada buscado ainda, e a abertura da página acabou de pedir a busca", () => {
    const vazio = {
      ...painelBase,
      ultimaAtualizacaoEm: null,
      ultimaTentativaEm: null,
      importacao: null,
    };
    expect(texto(vazio)).toContain("Ainda não buscamos nada da Garmin.");
    expect(texto(vazio, null, true)).toContain(
      "Pedimos à Garmin os dados novos agora. Recarregue a página em um minuto",
    );
  });

  it("o botão nunca diz que a atualização 'iniciou' quando a Garmin recusou a chave", () => {
    const t = texto(painelBase, "chave_recusada");
    expect(t).toContain("A Garmin ainda recusou a chave");
    expect(t).not.toMatch(/iniciada|iniciou/i);
    expect(texto(painelBase, "atualizada")).toContain("Pronto: buscamos os dados novos da Garmin.");
    expect(texto(painelBase, "muito_cedo")).toContain("Uma atualização acabou de rodar");
    expect(texto(painelBase, "token_recusado")).toContain("não um problema da sua chave");
  });

  it("todo resultado possível da sync tem uma mensagem no botão", () => {
    for (const resultado of RESULTADOS_DA_ATUALIZACAO) {
      expect(marcacao(painelBase, resultado), resultado).toContain('role="status"');
    }
  });

  it("pausa pedida pela Garmin aparece como estado, não como culpa", () => {
    expect(texto({ ...painelBase, pausadaAte: "2026-11-15T16:00:00.000Z" })).toMatch(
      /A Garmin pediu para esperar\. O app volta a buscar depois das 13:00/,
    );
  });

  it("estados vazios: não configurada e indisponível (com o gesto 'Tentar de novo')", () => {
    const naoConfigurada = texto({
      ...painelBase,
      situacao: "nao_configurada",
      podeAtualizar: false,
    });
    expect(naoConfigurada).toContain("A conexão com a Garmin ainda não foi configurada.");
    expect(naoConfigurada).not.toContain("ambiente");
    const indisponivel = marcacao({ ...painelBase, situacao: "indisponivel" });
    expect(indisponivel).toContain('<a href="/app">Tentar de novo</a>');
  });

  it("nenhum texto julga ou recomenda treino", () => {
    const todos = [
      texto({ ...painelBase, aviso: { tipo: "ausente" } }),
      texto({ ...painelBase, aviso: { tipo: "mal_formada" } }),
      texto({ ...painelBase, aviso: { tipo: "venceu" } }),
      texto({ ...painelBase, aviso: { tipo: "sem_data" }, problema: "formato_inesperado" }),
      texto({ ...painelBase, situacao: "nao_configurada", podeAtualizar: false }),
      texto({ ...painelBase, situacao: "indisponivel" }),
      ...RESULTADOS_DA_ATUALIZACAO.map((r) => texto(painelBase, r)),
    ].join(" ");
    for (const proibida of [/improdutiv/i, /\bruim\b/i, /\bvoc[êe] deve\b/i, /\btreine\b/i]) {
      expect(todos).not.toMatch(proibida);
    }
    expect(todos).not.toMatch(/\btoken\b/i);
  });
});
