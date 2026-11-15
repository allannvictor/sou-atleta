# Quadro ao vivo no GitHub Projects

O quadro mostra os agentes trabalhando: cada issue e PR em uma coluna, com um rótulo por agente. Não dá para criar o quadro por código nesta fase; o dono cria uma vez, em cerca de 5 minutos.

## 1. Criar os rótulos

Em **Issues → Labels → New label**, crie:

| Rótulo                   | Uso                                         |
| ------------------------ | ------------------------------------------- |
| `agente:produto`         | Especificação ou pesquisa de produto        |
| `agente:ia`              | Engenharia de IA                            |
| `agente:desenvolvimento` | Implementação                               |
| `agente:seguranca`       | Segurança e cibersegurança                  |
| `agente:ux`              | Revisão de UX                               |
| `agente:metricas`        | Métricas e fórmulas                         |
| `agente:juridico`        | Jurídico e conformidade                     |
| `agente:jardineiro`      | Limpeza e regras novas                      |
| `virar-regra`            | Correção que deve virar checagem automática |
| `aguardando-dono`        | Precisa de decisão ou aprovação do dono     |

## 2. Criar o quadro

1. Na organização ou no seu perfil: **Projects → New project → Board**. Nome: `Sou Atleta`.
2. Crie a coluna **Status** com estas opções, na ordem: `Issue`, `Especificação`, `Sua aprovação`, `Implementação`, `CI`, `Revisão`, `Mesclar`, `Pronto`.
3. Em **Settings → Workflows**, ative:
   - **Auto-add to project** para o repositório `athlete-evaluation` (issues e PRs novos entram sozinhos).
   - **Item closed** → Status `Pronto`.
   - **Pull request merged** → Status `Pronto`.
4. Agrupe a visualização por rótulo se quiser ver uma raia por agente.

## 3. No celular

O app do GitHub mostra o quadro em **Projects**.
