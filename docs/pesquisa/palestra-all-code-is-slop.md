# Palestra: "All Code Is Slop (Except Mine)"

Lauren Tan ("Potato"), SpaceXSI, canal AI Engineer. https://www.youtube.com/watch?v=O_zcc6Xl12g

Esta palestra define como o Sou Atleta é construído por agentes.

## Tese

A função do engenheiro passa a ser manter ou melhorar a qualidade do código enquanto multiplica a produtividade com agentes. O caminho é **confiança construída**, não cega: investir no ambiente dos agentes para poder confiar que farão a coisa certa. A equipe dela fez 11.000 PRs em um mês com cerca de 0,5% revertidos, e o app ficou mais rápido no período. Levou 6 meses para chegar lá.

## A pirâmide de confiança (onde investir, em ordem)

1. **O próprio código:** boa API, boa arquitetura, refatoração. O código é a maior entrada do agente, e o agente copia o que parece ser o padrão.
2. **Checagens determinísticas:** lint, tipos, compilador, testes.
3. **Verificação:** em tempo de execução (o agente roda o app, tira prints, grava vídeo) e formal (TLA+, Lean, testes baseados em propriedades).
4. **Texto por último:** regras, skills, `AGENTS.md`. Exigem julgamento e não são garantidos.

## Ideias aplicadas aqui

- **Toda correção vira regra executável.** Em vez de mais uma linha no `AGENTS.md`, uma regra de lint ou uma API que torne o erro impossível.
- **O código é um jardim.** Gambiarras e padrões ruins se espalham porque o próximo agente os copia.
- **Proibir o que exige nuance.** Ela proibiu `useEffect` no código de produto; o problema acabou de vez.
- **A estrutura de pastas carrega contexto,** com importações proibidas entre camadas garantidas por regra.
- **Comentários não podem justificar atalhos.** Agentes usam comentários para justificar gambiarras; mensagens de erro de lint que explicam a causa real funcionam melhor.
- **Mapa de funcionalidades** como vocabulário comum entre pessoas e agentes.
- **A maior parte dos tokens vai para verificação** (cerca de 70%). A revisão vira olhar provas: vídeos, prints, diagramas de estado.
- **Base antes de "fábrica de software".** Se o ciclo básico produz porcaria, automatizar só produz mais porcaria, e mais cara.

## Ressalvas

Os números vêm de uma equipe grande, com framework próprio e meses de investimento. Proibir 99% dos comentários é radical: aqui, comentários que explicam o porquê de uma regra de negócio ou de uma fórmula, com a fonte, continuam valendo. Verificação formal fica para depois.
