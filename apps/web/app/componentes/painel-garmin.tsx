import type { PainelDaGarmin, ResultadoDaAtualizacao } from "../server/garmin";

/**
 * Quadro "Sua conta Garmin" da área fechada (issue #5): o aviso sobre a chave, quando a
 * sincronização rodou pela última vez, como anda a importação do histórico e o botão
 * "Atualizar agora". Só descreve o que acontece; não recomenda nada.
 */

const FUSO = "America/Sao_Paulo";

function dataEHora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: FUSO,
  }).format(new Date(iso));
}

function dataPorExtenso(dia: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${dia}T00:00:00Z`),
  );
}

function horaCurta(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: FUSO }).format(
    new Date(iso),
  );
}

const MENSAGENS_DO_BOTAO: Readonly<Record<ResultadoDaAtualizacao, string>> = {
  iniciada: "Atualização iniciada. Em instantes os dados novos aparecem aqui.",
  muito_cedo: "Você atualizou há pouco. Espere um minuto e tente de novo.",
  pausada: "A Garmin pediu para esperar. O app tenta de novo sozinho.",
  ja_em_andamento: "Já existe uma atualização em andamento.",
  sem_chave: "A chave da Garmin ainda não está pronta. Veja o aviso acima.",
  nao_configurada: "A sincronização ainda não está ligada neste ambiente.",
  erro: "Não conseguimos iniciar a atualização agora. Tente de novo em instantes.",
};

function textoDoAviso(aviso: NonNullable<PainelDaGarmin["aviso"]>): {
  titulo: string;
  texto: string;
} {
  switch (aviso.tipo) {
    case "ausente":
      return {
        titulo: "Chave não cadastrada",
        texto:
          "Sua chave da Garmin ainda não está no cofre, então o app não busca dados novos. Gere uma e cadastre no cofre.",
      };
    case "mal_formada":
      return {
        titulo: "Chave com problema",
        texto:
          "A chave cadastrada no cofre parece mal colada (por exemplo, com aspas). Gere outra e cadastre de novo no cofre, só com a chave.",
      };
    case "invalida":
      return {
        titulo: aviso.expirou ? "Chave expirada" : "Chave recusada pela Garmin",
        texto: aviso.expirou
          ? "Sua chave da Garmin expirou. Gere outra e cadastre no cofre. Enquanto isso, o app continua abrindo com os dados já guardados."
          : "A Garmin recusou a chave: ela pode ter expirado ou sido revogada. Gere outra e cadastre no cofre. Enquanto isso, o app continua abrindo com os dados já guardados.",
      };
    case "venceu":
      return {
        titulo: "Chave vencida",
        texto:
          "A data de vencimento da sua chave da Garmin já passou. Gere outra e cadastre no cofre. O app continua abrindo com os dados já guardados.",
      };
    case "vence": {
      const quando =
        aviso.dias === 0
          ? "vence hoje"
          : aviso.dias === 1
            ? "vence em 1 dia"
            : `vence em ${String(aviso.dias)} dias`;
      return {
        titulo: "Chave perto do vencimento",
        texto: `Sua chave da Garmin ${quando}. Gere outra e cadastre no cofre antes disso, para a sincronização não parar.`,
      };
    }
    case "sem_data":
      return {
        titulo: "Falta a data de vencimento da chave",
        texto:
          "A chave funciona, mas o app não sabe quando ela vence. Cadastre a data de vencimento no cofre para receber o aviso 14 dias antes.",
      };
  }
}

const PROBLEMAS: Readonly<Record<string, string>> = {
  garmin_indisponivel:
    "A Garmin não respondeu direito na última tentativa. O app tenta de novo sozinho.",
  rede: "Houve uma falha de conexão na última tentativa. O app tenta de novo sozinho.",
  formato_inesperado:
    "Parte dos dados da Garmin veio num formato que não esperávamos e ficou de fora. O app tenta de novo sozinho.",
  acesso_negado: "A Garmin não liberou parte dos dados. O app continua com o resto.",
  execucao_interrompida: "A última atualização foi interrompida. O app tenta de novo sozinho.",
  erro_interno: "A última atualização não terminou. O app tenta de novo sozinho.",
};

export interface PainelGarminProps {
  readonly painel: PainelDaGarmin;
  /** Resultado do último clique em "Atualizar agora" (vem da URL depois do redirecionamento). */
  readonly resultado: ResultadoDaAtualizacao | null;
}

export function PainelGarmin({ painel, resultado }: PainelGarminProps) {
  const aviso = painel.aviso === null ? null : textoDoAviso(painel.aviso);
  const problema =
    painel.problema !== null &&
    painel.problema !== "chave_invalida" &&
    painel.problema !== "limite_garmin"
      ? PROBLEMAS[painel.problema]
      : undefined;

  return (
    <section className="painel" aria-labelledby="garmin-titulo">
      <h2 id="garmin-titulo">Sua conta Garmin</h2>

      {painel.situacao === "nao_configurada" && (
        <p>A conexão com a Garmin ainda não foi configurada neste ambiente.</p>
      )}
      {painel.situacao === "indisponivel" && (
        <p>Não conseguimos ler o estado da sincronização agora. Tente de novo em instantes.</p>
      )}

      {aviso !== null && (
        <div className="aviso" data-tipo={painel.aviso?.tipo}>
          <h3>{aviso.titulo}</h3>
          <p>{aviso.texto}</p>
        </div>
      )}

      {painel.situacao === "pronta" && (
        <>
          {painel.ultimaAtualizacaoEm === null ? (
            <p>Ainda não houve uma atualização completa.</p>
          ) : (
            <p>
              Última atualização:{" "}
              <time dateTime={painel.ultimaAtualizacaoEm}>
                {dataEHora(painel.ultimaAtualizacaoEm)}
              </time>
              .
            </p>
          )}
          {painel.importacao?.emAndamento === true && (
            <p>
              Importando o seu histórico da Garmin, aos poucos
              {painel.importacao.ate === null
                ? "."
                : `: já buscamos até ${dataPorExtenso(painel.importacao.ate)}.`}
            </p>
          )}
          {painel.pausadaAte !== null && (
            <p>
              A Garmin pediu para esperar. O app volta a buscar depois das{" "}
              <time dateTime={painel.pausadaAte}>{horaCurta(painel.pausadaAte)}</time>.
            </p>
          )}
          {problema !== undefined && <p>{problema}</p>}
        </>
      )}

      {resultado !== null && (
        <p className="retorno" role="status">
          {MENSAGENS_DO_BOTAO[resultado]}
        </p>
      )}

      {painel.podeAtualizar && (
        <form method="post" action="/app" className="acao">
          <button type="submit" className="botao">
            Atualizar agora
          </button>
          <p className="ajuda">
            Busca os dados novos da Garmin fora da rotina de a cada 15 minutos.
          </p>
        </form>
      )}
    </section>
  );
}
