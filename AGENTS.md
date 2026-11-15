# Sou Atleta: guia para agentes

Este arquivo é curto de propósito. Tudo que dá para verificar automaticamente vira lint, tipo ou teste, não uma linha aqui.

## Antes de qualquer tarefa

1. Leia a issue e a especificação aprovada. Sem especificação aprovada pelo dono do projeto, não implemente.
2. Leia as decisões em `docs/decisoes/`. Elas valem mais que qualquer suposição sua.
3. Rode `pnpm check` antes de abrir o PR. Ele precisa passar.

## Regras de produto que não mudam

- O app **descreve e estima**. Nunca recomenda treino, nunca prescreve, nunca julga ("ruim", "improdutivo"). Não substitui treinador, médico ou outro profissional.
- **Números vêm só do `packages/core`.** A IA nunca calcula nem digita número.
- **O app funciona 100% sem IA.** Texto de IA é enriquecimento com reserva por modelo de texto.
- Linguagem simples em pt-BR, tratamento por "você". Nomes das métricas em `docs/decisoes/0001-produto-e-visao.md`.
- Dados do Strava nunca passam pelo `packages/narrative` nem treinam modelo.
- A chave da Garmin nunca é gravada em banco, log ou arquivo.

## Como trabalhar

- Camadas: `core` não importa nada do projeto; `narrative` só recebe fatos do `core`. O lint garante.
- Comentários explicam o **porquê** de uma regra de negócio ou de uma fórmula, com a fonte. Nunca justificam gambiarra: se precisa de gambiarra, abra uma issue.
- Toda métrica nova precisa de documento em `docs/metricas/` antes do código.
- PR traz provas: saída dos testes, prints de tela (celular e desktop, claro e escuro) quando houver interface, resultado da bateria de IA quando mexer no `narrative`.
- Quando uma correção sua for apontada por um humano ou revisor, proponha transformá-la em regra automática (issue com rótulo `virar-regra`).

## Quando parar e perguntar ao dono

- Mudança em fórmula do `core`, validadores do `narrative`, autenticação, chave Garmin ou migração de banco.
- Qualquer dúvida sobre termos de uso (Garmin, Strava, Cloudflare), LGPD ou dados reais de usuários.
- Qualquer coisa que gere custo financeiro.
