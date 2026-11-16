import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { PainelDaGarmin } from "../server/garmin";
import { PainelGarmin } from "./painel-garmin";

const painelBase: PainelDaGarmin = {
  situacao: "pronta",
  aviso: null,
  ultimaAtualizacaoEm: "2026-11-15T14:45:00.000Z",
  importacao: { emAndamento: false, ate: "2026-11-15" },
  pausadaAte: null,
  problema: null,
  podeAtualizar: true,
};

const texto = (
  painel: PainelDaGarmin,
  resultado: Parameters<typeof PainelGarmin>[0]["resultado"] = null,
) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <PainelGarmin painel={painel} resultado={resultado} />
    </MemoryRouter>,
  )
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");

describe("quadro da conta Garmin", () => {
  it("mostra o botão 'Atualizar agora' e a última atualização", () => {
    const t = texto(painelBase);
    expect(t).toContain("Atualizar agora");
    expect(t).toMatch(/Última atualização: 15 de novembro de 2026 às? 11:45/);
  });

  it("sem ligação com a sync, não mostra o botão", () => {
    expect(texto({ ...painelBase, podeAtualizar: false })).not.toContain("Atualizar agora");
  });

  it("chave expirada: 'Sua chave da Garmin expirou. Gere outra e cadastre no cofre.'", () => {
    const t = texto({ ...painelBase, aviso: { tipo: "invalida", expirou: true } });
    expect(t).toContain("Sua chave da Garmin expirou. Gere outra e cadastre no cofre.");
    expect(t).toContain("o app continua abrindo com os dados já guardados");
  });

  it("chave revogada ou recusada tem texto próprio", () => {
    expect(texto({ ...painelBase, aviso: { tipo: "invalida", expirou: false } })).toContain(
      "A Garmin recusou a chave",
    );
  });

  it("vencimento: 'vence em N dias' (e hoje / 1 dia)", () => {
    expect(texto({ ...painelBase, aviso: { tipo: "vence", dias: 14 } })).toContain(
      "Sua chave da Garmin vence em 14 dias.",
    );
    expect(texto({ ...painelBase, aviso: { tipo: "vence", dias: 1 } })).toContain(
      "vence em 1 dia.",
    );
    expect(texto({ ...painelBase, aviso: { tipo: "vence", dias: 0 } })).toContain("vence hoje.");
  });

  it("sem aviso, nenhum quadro de aviso aparece", () => {
    const marcacao = renderToStaticMarkup(
      <MemoryRouter>
        <PainelGarmin painel={painelBase} resultado={null} />
      </MemoryRouter>,
    );
    expect(marcacao).not.toContain('class="aviso"');
  });

  it("importação em andamento diz até onde já foi", () => {
    const t = texto({ ...painelBase, importacao: { emAndamento: true, ate: "2023-02-01" } });
    expect(t).toContain("já buscamos até 1 de fevereiro de 2023");
  });

  it("pausa pedida pela Garmin e resultado do botão aparecem como estado, não como culpa", () => {
    expect(texto({ ...painelBase, pausadaAte: "2026-11-15T16:00:00.000Z" })).toMatch(
      /A Garmin pediu para esperar\. O app volta a buscar depois das 13:00/,
    );
    expect(texto(painelBase, "iniciada")).toContain("Atualização iniciada");
    expect(texto(painelBase, "muito_cedo")).toContain("Espere um minuto");
  });

  it("nenhum texto julga ou recomenda treino", () => {
    const todos = [
      texto({ ...painelBase, aviso: { tipo: "ausente" } }),
      texto({ ...painelBase, aviso: { tipo: "mal_formada" } }),
      texto({ ...painelBase, aviso: { tipo: "venceu" } }),
      texto({ ...painelBase, aviso: { tipo: "sem_data" }, problema: "formato_inesperado" }),
      texto({ ...painelBase, situacao: "nao_configurada", podeAtualizar: false }),
      texto({ ...painelBase, situacao: "indisponivel" }),
    ].join(" ");
    for (const proibida of [/improdutiv/i, /\bruim\b/i, /\bvoc[êe] deve\b/i, /\btreine\b/i]) {
      expect(todos).not.toMatch(proibida);
    }
    expect(todos).not.toMatch(/\btoken\b/i);
  });
});
