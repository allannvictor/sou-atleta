import { useState } from "react";

import type {
  PainelDaGarmin,
  ProgressoDaImportacao,
  ResultadoDaAtualizacao,
} from "../server/garmin";

/**
 * Quadro "Sua conta Garmin" da área fechada (issue #5): o aviso sobre a chave, o que fazer, a
 * última tentativa e a última atualização, como anda a importação dos últimos 3 meses e o botão
 * "Atualizar agora". Só descreve o que acontece; não recomenda treino.
 *
 * Vocabulário da chave: "vence" e "venceu" para a data; "recusada" quando a Garmin disse não.
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

/** Dia e mês, como "12/10". */
function diaEMes(dia: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${dia}T00:00:00Z`));
}

function horaCurta(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: FUSO }).format(
    new Date(iso),
  );
}

const MENSAGENS_DO_BOTAO: Readonly<Record<ResultadoDaAtualizacao, string>> = {
  iniciada: "Pedimos uma atualização. Recarregue a página em um minuto para ver o resultado.",
  atualizada: "Pronto: buscamos os dados novos da Garmin.",
  atualizada_em_parte: "Buscamos uma parte dos dados. Veja o que ficou de fora nos avisos abaixo.",
  chave_recusada:
    "A Garmin ainda recusou a chave. Confira se a chave nova foi cadastrada inteira, sem aspas.",
  token_recusado: "A atualização não passou. Veja o aviso acima.",
  pausada: "A Garmin pediu para esperar. Tente de novo depois do horário indicado.",
  garmin_fora: "A Garmin não respondeu agora. Tente de novo mais tarde.",
  sem_chave: "A chave da Garmin ainda não está pronta. Veja os passos no aviso.",
  muito_cedo: "Uma atualização acabou de rodar. Espere um minuto e tente de novo.",
  ja_em_andamento: "Já existe uma atualização em andamento.",
  nao_configurada: "A sincronização ainda não está ligada.",
  nao_liberada: "A sincronização com a Garmin ainda não foi liberada.",
  erro: "Não conseguimos atualizar agora. Tente de novo em instantes.",
};

/** O que fazer quando a chave precisa ser trocada. Vale para ausente, mal colada, recusada e vencida. */
function Passos() {
  return (
    <>
      <p>
        <strong>Para voltar a sincronizar:</strong>
      </p>
      <ol>
        <li>
          No Garmin Connect Web, gere uma chave nova da Personal API, com validade de 180 dias.
        </li>
        <li>
          Cadastre a chave <strong>e a nova data de vencimento</strong> (<code>GARMIN_API_KEY</code>{" "}
          e <code>GARMIN_CHAVE_VENCE_EM</code>) no cofre de segredos da Cloudflare, na Worker{" "}
          <code>sou-atleta-sync</code>, com o comando <code>wrangler secret put</code>. O passo a
          passo está na decisão 0005 (arquitetura) do projeto.
        </li>
        <li>Toque em &ldquo;Atualizar agora&rdquo; para conferir.</li>
      </ol>
    </>
  );
}

type Aviso = NonNullable<PainelDaGarmin["aviso"]>;

function textoDoAviso(
  aviso: Aviso,
  chaveVenceEm: string | null,
): { rotulo: string; titulo: string; texto: string; comPassos: boolean } {
  const quando = chaveVenceEm === null ? "" : ` em ${dataPorExtenso(chaveVenceEm)}`;
  switch (aviso.tipo) {
    case "ausente":
      return {
        rotulo: "Precisa de você",
        titulo: "Chave não cadastrada",
        texto: "Sua chave da Garmin ainda não está no cofre, então o app não busca dados novos.",
        comPassos: true,
      };
    case "mal_formada":
      return {
        rotulo: "Precisa de você",
        titulo: "Chave com problema",
        texto:
          "A chave cadastrada no cofre parece mal colada (por exemplo, com aspas). Cadastre de novo, só com a chave.",
        comPassos: true,
      };
    case "invalida":
      return {
        rotulo: "Precisa de você",
        titulo: aviso.expirou ? "Chave vencida" : "Chave recusada pela Garmin",
        texto: aviso.expirou
          ? `Sua chave da Garmin venceu${quando}. O app continua abrindo com os dados já guardados.`
          : "A Garmin recusou a chave: ela pode ter vencido ou sido revogada. O app continua abrindo com os dados já guardados.",
        comPassos: true,
      };
    case "venceu":
      return {
        rotulo: "Precisa de você",
        titulo: "Chave vencida",
        texto: `A data de vencimento da sua chave da Garmin já passou${quando}. Se você já gerou uma chave nova, falta atualizar também a data de vencimento no cofre. O app continua abrindo com os dados já guardados.`,
        comPassos: true,
      };
    case "vence": {
      const data = chaveVenceEm === null ? "" : dataPorExtenso(chaveVenceEm);
      const prazo =
        aviso.dias === 0
          ? `vence hoje${data === "" ? "" : ` (${data})`}`
          : `${aviso.dias === 1 ? "vence em 1 dia" : `vence em ${String(aviso.dias)} dias`}${data === "" ? "" : `, em ${data}`}`;
      return {
        rotulo: "Aviso",
        titulo: "Chave perto do vencimento",
        texto: `Sua chave da Garmin ${prazo}. Gere outra e cadastre no cofre antes disso, junto com a nova data de vencimento, para a sincronização não parar.`,
        comPassos: false,
      };
    }
    case "sem_data":
      return {
        rotulo: "Aviso",
        titulo: "Falta a data de vencimento da chave",
        texto:
          "A chave funciona, mas o app não sabe quando ela vence. Cadastre a data (GARMIN_CHAVE_VENCE_EM) no cofre para receber o aviso 14 dias antes.",
        comPassos: false,
      };
  }
}

/** Como a última tentativa terminou, em palavras. */
const RESULTADO_DA_TENTATIVA: Readonly<Record<string, string>> = {
  chave_invalida: "A Garmin recusou a chave.",
  // token_recusado: o aviso acima já explica; a linha da tentativa só traz o horário.
  limite_garmin: "A Garmin pediu para esperar.",
  garmin_indisponivel: "A Garmin não respondeu direito.",
  rede: "Houve uma falha de conexão.",
  formato_inesperado: "Parte dos dados veio num formato que não esperávamos.",
  acesso_negado: "A Garmin não liberou parte dos dados.",
  execucao_interrompida:
    "Uma tentativa parou no meio. O app continua de onde parou na próxima abertura da página ou no botão Atualizar agora.",
  erro_interno: "A tentativa não terminou.",
};

export interface PainelGarminProps {
  readonly painel: PainelDaGarmin;
  /** Resultado do último clique em "Atualizar agora" (vem da URL depois do redirecionamento). */
  readonly resultado: ResultadoDaAtualizacao | null;
  /** A abertura da página acabou de pedir uma sincronização. */
  readonly buscaPedida?: boolean;
  /** Só para os prints e testes: começa no estado "Atualizando…" (o clique já foi dado). */
  readonly enviandoInicialmente?: boolean;
}

/** Texto da importação dos 3 meses, conforme anda ou por que parou. */
function textoDaImportacao(importacao: ProgressoDaImportacao, pausadaAte: string | null): string {
  const trazido =
    importacao.ate === null
      ? ""
      : ` Já trouxemos${importacao.de === null ? "" : ` de ${diaEMes(importacao.de)}`} até ${diaEMes(importacao.ate)}.`;
  switch (importacao.parada) {
    case "chave":
      return `A importação está parada até a chave funcionar.${trazido}`;
    case "conector":
      return `A importação está parada até o app ser ajustado.${trazido}`;
    case "espera":
      return `A importação está pausada${pausadaAte === null ? "" : ` até ${horaCurta(pausadaAte)}`}; o botão Atualizar agora funciona antes disso.${trazido}`;
    case null:
      return importacao.ate === null
        ? "Trazendo seus últimos 3 meses."
        : `Trazendo seus últimos 3 meses:${importacao.de === null ? "" : ` de ${diaEMes(importacao.de)}`} até ${diaEMes(importacao.ate)}.`;
  }
}

export function PainelGarmin({
  painel,
  resultado,
  buscaPedida = false,
  enviandoInicialmente = false,
}: PainelGarminProps) {
  const [enviando, setEnviando] = useState(enviandoInicialmente);
  const aviso = painel.aviso === null ? null : textoDoAviso(painel.aviso, painel.chaveVenceEm);
  const problemaDoConector = painel.problema === "token_recusado";

  return (
    <section className="painel" aria-labelledby="garmin-titulo">
      <h2 id="garmin-titulo">Sua conta Garmin</h2>

      {painel.situacao === "nao_configurada" && (
        <p>A conexão com a Garmin ainda não foi configurada.</p>
      )}
      {painel.situacao === "indisponivel" && (
        <p>
          Não conseguimos ler o estado da sincronização agora. <a href="/app">Tentar de novo</a>
        </p>
      )}

      {painel.situacao === "nao_liberada" && (
        <div className="aviso" data-tipo="nao_liberada">
          <p className="rotulo">Aviso</p>
          <h3>Sincronização ainda não liberada</h3>
          <p>
            A sincronização com a Garmin ainda não foi liberada. Ela começa depois que a política de
            privacidade for revista; até lá, o app não busca nada na Garmin.
          </p>
        </div>
      )}

      {aviso !== null && (
        <div className="aviso" data-tipo={painel.aviso?.tipo}>
          <p className="rotulo">{aviso.rotulo}</p>
          <h3>{aviso.titulo}</h3>
          <p>{aviso.texto}</p>
          {aviso.comPassos && <Passos />}
        </div>
      )}
      {problemaDoConector && (
        <div className="aviso" data-tipo="conector">
          <p className="rotulo">Ajuste do app</p>
          <h3>A Garmin recusou o acesso aos dados</h3>
          <p>
            A Garmin aceitou a sua chave, mas recusou o acesso aos dados. Provavelmente é um ajuste
            no app, e você não precisa gerar outra chave.
          </p>
        </div>
      )}

      {painel.situacao === "pronta" && (
        <dl className="situacao">
          <div>
            <dt>Última atualização</dt>
            <dd>
              {painel.ultimaAtualizacaoEm === null ? (
                "Ainda não buscamos nada da Garmin."
              ) : (
                <time dateTime={painel.ultimaAtualizacaoEm}>
                  {dataEHora(painel.ultimaAtualizacaoEm)}
                </time>
              )}
            </dd>
          </div>
          {painel.ultimaTentativaEm !== null && (
            <div>
              <dt>Última tentativa</dt>
              <dd>
                <time dateTime={painel.ultimaTentativaEm}>
                  {dataEHora(painel.ultimaTentativaEm)}
                </time>
                .{" "}
                {painel.problema === null
                  ? "Funcionou."
                  : (RESULTADO_DA_TENTATIVA[painel.problema] ?? "")}
              </dd>
            </div>
          )}
          {painel.chaveVenceEm !== null && (
            <div>
              <dt>Chave da Garmin</dt>
              <dd>
                {painel.aviso?.tipo === "venceu" ||
                (painel.aviso?.tipo === "invalida" && painel.aviso.expirou)
                  ? "Venceu"
                  : "Vence"}{" "}
                em <time dateTime={painel.chaveVenceEm}>{dataPorExtenso(painel.chaveVenceEm)}</time>
                .
              </dd>
            </div>
          )}
          {painel.importacao?.emAndamento === true && (
            <div>
              <dt>Últimos 3 meses</dt>
              <dd>{textoDaImportacao(painel.importacao, painel.pausadaAte)}</dd>
            </div>
          )}
          {painel.importacao?.emAndamento === false && (
            <div>
              <dt>Últimos 3 meses</dt>
              <dd>Já foram trazidos. Daqui para a frente o app busca só o que é novo.</dd>
            </div>
          )}
          {painel.pausadaAte !== null && (
            <div>
              <dt>Garmin</dt>
              <dd>
                {painel.problema === "limite_garmin" ? (
                  <>
                    A Garmin pediu para esperar. O app volta a buscar depois das{" "}
                    <time dateTime={painel.pausadaAte}>{horaCurta(painel.pausadaAte)}</time>.
                  </>
                ) : (
                  <>
                    O app espera até{" "}
                    <time dateTime={painel.pausadaAte}>{horaCurta(painel.pausadaAte)}</time> para
                    tentar de novo sozinho. O botão Atualizar agora funciona antes disso.
                  </>
                )}
              </dd>
            </div>
          )}
        </dl>
      )}

      {buscaPedida &&
        resultado === null &&
        painel.situacao === "pronta" &&
        painel.aviso?.tipo !== "ausente" &&
        painel.aviso?.tipo !== "mal_formada" && (
          <p>
            Pedimos à Garmin os dados novos agora. Recarregue a página em um minuto para ver o
            resultado.
          </p>
        )}
      {resultado !== null && (
        <p className="retorno" role="status">
          {MENSAGENS_DO_BOTAO[resultado]}
        </p>
      )}

      {painel.podeAtualizar && (
        <form
          method="post"
          action="/app"
          className="acao"
          onSubmit={(evento) => {
            // Um toque só: enquanto espera, o botão não dispara de novo.
            if (enviando) evento.preventDefault();
            else setEnviando(true);
          }}
        >
          <button
            type="submit"
            className="botao"
            aria-disabled={enviando}
            aria-describedby="ajuda-do-botao"
          >
            {enviando ? "Atualizando…" : "Atualizar agora"}
          </button>
          <p className="ajuda" id="ajuda-do-botao">
            O app já busca dados novos sozinho quando você abre esta página. Use o botão se quiser
            adiantar.
          </p>
        </form>
      )}
    </section>
  );
}
