# 0006: Equipe de agentes e fluxo de trabalho

Todo o desenvolvimento é feito por agentes, no modelo da palestra "All Code Is Slop (Except Mine)" (resumo em `docs/pesquisa/palestra-all-code-is-slop.md`): confiança construída com código bom, checagens determinísticas e verificação, com texto de instrução por último.

## Equipe

Definições em `.claude/agents/`. Modelos escolhidos pelo risco do trabalho: os maiores só onde o CI ainda não cobre bem.

| Agente                     | Arquivo               | Modelo | Esforço |
| -------------------------- | --------------------- | ------ | ------- |
| Produto                    | `produto.md`          | Sonnet | médio   |
| Engenharia de IA           | `engenharia-ia.md`    | Opus   | alto    |
| Desenvolvimento            | `desenvolvimento.md`  | Sonnet | alto    |
| Revisor de código          | `revisor-codigo.md`   | Sonnet | alto    |
| Segurança e cibersegurança | `seguranca.md`        | Opus   | alto    |
| Revisor de UX              | `revisor-ux.md`       | Sonnet | médio   |
| Revisor de métricas        | `revisor-metricas.md` | Opus   | alto    |
| Jurídico e conformidade    | `juridico.md`         | Sonnet | alto    |
| Jardineiro                 | `jardineiro.md`       | Haiku  | baixo   |

A sessão principal, que orquestra e cuida de arquitetura, usa Opus. A família Fable fica fora do uso padrão; só sob pedido do dono.

Critério de ajuste: custo por tarefa concluída, não por chamada. O Jardineiro acompanha PRs refeitos e correções por agente, e o mapa muda com dados.

## Ciclo de uma funcionalidade

1. O dono abre uma issue.
2. Produto escreve uma especificação curta na issue.
3. **O dono aprova** (ou pede ajuste). Sem aprovação, nada é implementado.
4. Desenvolvimento implementa e abre o PR com provas.
5. O CI roda todas as checagens.
6. Os revisores comentam, cada um na sua especialidade.
7. Mesclagem conforme a política de confiança.

## Política de confiança

- **Agora:** o dono aprova todo PR.
- **Depois, com checagens maduras:** mesclagem automática para documentação, testes e atualizações pequenas de dependência, sempre com CI verde e sem bloqueio dos revisores.
- **Sempre com o dono:** fórmulas do `core`, validadores do `narrative`, chave da Garmin e autenticação, migrações de banco.

## Toda correção vira regra

Quando o dono ou um revisor corrige um agente, a correção vira uma issue com rótulo `virar-regra`. O Jardineiro a transforma em regra de lint, teste ou mudança de API. Não em mais uma linha no `AGENTS.md`.

## Acompanhamento

Ao vivo pelo GitHub Projects (passos em `docs/github-projects.md`). A página "Raias dos Agentes" mostra o mapa da equipe.

## Custo

O custo zero vale para o app rodando. Os agentes que constroem o app usam o plano do Claude do dono. Rodar agentes direto no GitHub (Claude GitHub Action) normalmente exige chave de API paga; por isso o trabalho roda em sessões do Claude Code.
