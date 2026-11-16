import type { MomentoAtual } from "../server/momento-atual";

/**
 * "Momento atual" (issues #37 e #38): Base, Carga recente e Saldo, o que mais pesou nos últimos
 * dias, variação da carga, volume por semana e distribuição por zona. Só descreve; nunca
 * recomenda nem julga (decisão 0001). Os textos vêm prontos do `narrative` e os números do
 * `core`: este componente só os organiza na tela.
 */

function SemDados({ importando }: { readonly importando: boolean }) {
  return (
    <p>
      {importando
        ? "Seus dados da Garmin ainda estão chegando. Quando chegarem, os números aparecem aqui."
        : "Quando os seus dados da Garmin chegarem, os números aparecem aqui."}
    </p>
  );
}

export function MomentoAtualQuadro({ momento }: { readonly momento: MomentoAtual }) {
  return (
    <section aria-labelledby="titulo-momento-atual" className="momento-atual">
      <h2 id="titulo-momento-atual">Como você está</h2>
      {momento.situacao === "indisponivel" ? <SemDados importando={false} /> : null}
      {momento.situacao === "sem_atividades" ? (
        <SemDados importando={momento.importacaoEmAndamento} />
      ) : null}
      {momento.situacao === "pronto" ? <Pronto momento={momento} /> : null}
    </section>
  );
}

function Pronto({ momento }: { readonly momento: Extract<MomentoAtual, { situacao: "pronto" }> }) {
  return (
    <>
      {momento.avisoDaImportacao === null ? null : (
        <p className="aviso-suave">{momento.avisoDaImportacao}</p>
      )}
      {momento.conhecendoABase === null ? null : (
        <p className="aviso-suave">{momento.conhecendoABase}</p>
      )}

      <ul className="cartoes-forma">
        {momento.cartoes.map((cartao) => (
          <li key={cartao.nome} className="cartao-forma">
            <h3>{cartao.nome}</h3>
            <p className="numero-grande">{cartao.valor}</p>
            <p>{cartao.frase}</p>
            <p className="texto-suave">{cartao.explicacao}</p>
          </li>
        ))}
      </ul>

      <h3 className="subtitulo">Por que mudou?</h3>
      <p className="texto-suave">{momento.explicacaoDaCarga}</p>
      {momento.porQueMudou.length === 0 ? (
        <p>Nos últimos 7 dias não houve treino com frequência cardíaca.</p>
      ) : (
        <>
          <p>Os treinos que mais pesaram nos últimos 7 dias:</p>
          <ul className="lista-simples">
            {momento.porQueMudou.map((treino) => (
              <li key={treino.texto}>
                {treino.texto}
                {treino.aviso === null ? null : (
                  <span className="texto-suave"> ({treino.aviso})</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {momento.treinosFora === null ? null : <p className="texto-suave">{momento.treinosFora}</p>}

      <h3 className="subtitulo">Variação da carga</h3>
      <p>{momento.variacao}</p>

      <h3 className="subtitulo">Volume por semana</h3>
      <ul className="lista-simples">
        {momento.semanas.map((semana) => (
          <li key={semana.rotulo}>
            <strong>{semana.rotulo}:</strong> {semana.frase}
          </li>
        ))}
      </ul>
      {momento.conhecendoOVolume === null ? null : (
        <p className="aviso-suave">{momento.conhecendoOVolume}</p>
      )}
      {momento.tendenciaDoVolume.length === 0 ? null : (
        <ul className="lista-simples">
          {momento.tendenciaDoVolume.map((frase) => (
            <li key={frase}>{frase}</li>
          ))}
        </ul>
      )}

      <h3 className="subtitulo">Intensidade dos últimos 28 dias</h3>
      {momento.intensidade === null ? (
        <p>Ainda não há tempo em zona de frequência cardíaca nos últimos 28 dias.</p>
      ) : (
        <>
          <p>{momento.intensidade.frase}</p>
          <ul className="zonas">
            {momento.intensidade.zonas.map(({ zona, percentual }) => (
              <li key={zona}>
                <span className="zona-nome">Zona {zona}</span>
                <span className="barra" aria-hidden="true">
                  <span className="barra-cheia" style={{ width: `${percentual.toFixed(1)}%` }} />
                </span>
                <span className="zona-valor">{Math.round(percentual)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="subtitulo">Recuperação</h3>
      <p className="texto-suave">{momento.explicacaoDoNormal}</p>
      <ul className="cartoes-forma">
        {momento.recuperacao.map((cartao) => (
          <li key={cartao.nome} className="cartao-forma">
            <h4>{cartao.nome}</h4>
            {cartao.frases.map((frase) => (
              <p key={frase}>{frase}</p>
            ))}
            <p className="texto-suave">{cartao.explicacao}</p>
            {cartao.origem === null ? null : <p className="texto-suave">{cartao.origem}</p>}
            <details>
              <summary>Últimos 7 dias</summary>
              <ul className="lista-simples">
                {cartao.ultimosDias.map((dia) => (
                  <li key={dia}>{dia}</li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
