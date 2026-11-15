# Sou Atleta

Seus dados de corrida explicados em linguagem simples.

O Sou Atleta lê os dados que o seu relógio Garmin já coleta e mostra três coisas que os apps de treino não mostram bem:

- **O porquê:** por que cada número mudou, apontando os treinos e dias que causaram a mudança.
- **Você contra você:** sua evolução ao longo de semanas, meses e anos, comparada com o seu próprio normal.
- **Tradutor da Garmin:** o que os rótulos da Garmin significam no seu caso, sem jargão.

O app descreve e estima. Ele não recomenda treino e não substitui treinador, médico ou outro profissional.

## Situação

Projeto fechado e não comercial, na etapa 1 (só o dono do projeto, com a chave pessoal da Garmin). Veja `docs/decisoes/` para tudo que já foi decidido.

## Como o projeto é construído

Todo o desenvolvimento é feito por uma equipe de agentes de IA, com o dono aprovando especificações e PRs. A equipe está em `.claude/agents/` e o fluxo em `docs/decisoes/0006-agentes-e-fluxo.md`.

## Comandos

```bash
pnpm install
pnpm check
```

`pnpm check` roda formatação, lint, tipos, testes e varredura de segredos. É a mesma checagem do CI.
