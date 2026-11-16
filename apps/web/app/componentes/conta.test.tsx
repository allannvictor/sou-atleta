import { frasesLongas, verificarLinguagem } from "@sou-atleta/narrative";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContaQuadro } from "./conta";

const marcacao = (resultado: Parameters<typeof ContaQuadro>[0]["resultado"] = null) =>
  renderToStaticMarkup(<ContaQuadro resultado={resultado} />);
const texto = (resultado: Parameters<typeof ContaQuadro>[0]["resultado"] = null) =>
  marcacao(resultado)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");

describe("tela Sua conta", () => {
  it("tem as três ações, cada uma com seu título e seu texto", () => {
    const t = texto();
    for (const trecho of [
      "Sair encerra a sua sessão neste aparelho. Seus dados continuam guardados.",
      "Desconectar interrompe a busca de dados novos. O que já veio da Garmin continua no app até você apagar a conta.",
      "Apaga tudo o que o app guardou sobre você: atividades, sono, HRV, resumos do dia, zonas e perfil. Não dá para desfazer.",
      "as cópias de segurança do banco, que somem em até 7 dias",
      "os registros técnicos da sincronização, que somem em até 3 dias e não têm dados de saúde",
      "nada é apagado na Garmin",
      "wrangler secret delete GARMIN_API_KEY",
    ]) {
      expect(t).toContain(trecho);
    }
  });

  it("Sair é um link para o logout do Access; apagar é um formulário POST com confirmação", () => {
    const m = marcacao();
    expect(m).toContain('href="/cdn-cgi/access/logout"');
    expect(m).toContain('method="post"');
    expect(m).toContain('name="confirmacao"');
    expect(m).toContain("required");
    expect(m).toContain('for="confirmacao"');
    expect(m).toContain("Apagar tudo");
  });

  it("mostra o resultado de apagar, com a explicação do que fazer", () => {
    expect(texto("apagado")).toContain("Pronto. Tudo o que o app guardava foi apagado.");
    expect(texto("chave_presente")).toContain("Antes de apagar, desconecte a Garmin");
    expect(texto("confirmacao_errada")).toContain("Nada foi apagado. Digite APAGAR");
    expect(marcacao("erro")).toContain('role="status"');
    expect(marcacao()).not.toContain('role="status"');
  });

  it("o texto da tela passa pela checagem de linguagem", () => {
    const t = texto("chave_presente");
    expect(verificarLinguagem(t)).toEqual([]);
    expect(frasesLongas(t).length).toBeLessThanOrEqual(2);
  });
});
