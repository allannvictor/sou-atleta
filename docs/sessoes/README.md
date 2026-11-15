# Passagem de sessão

O projeto é construído em conversas com o Claude (sessões). Uma sessão tem memória limitada e roda num ambiente temporário. Para nada se perder, vale esta regra (decisão do dono, 15/11/2026):

**Sempre que for preciso ir para uma nova sessão, a sessão atual:**

1. Documenta o estado do projeto num arquivo `docs/sessoes/AAAA-MM-DD-sessao-N.md`, seguindo o modelo abaixo.
2. Escreve o **prompt pronto** para colar na nova sessão, no fim desse arquivo.
3. Abre um PR com o arquivo e diz ao dono exatamente o que fazer: mesclar o PR, abrir a nova sessão com o repositório certo e colar o prompt.

A nova sessão começa lendo `AGENTS.md`, `docs/decisoes/` e o arquivo de passagem mais recente.

## Modelo

```markdown
# Sessão N (AAAA-MM-DD)

## Onde estamos

O que está pronto e no ar, com links.

## Em andamento

PRs abertos, agentes trabalhando, passos manuais do dono pela metade.

## Decisões tomadas nesta sessão

Uma linha por decisão, com onde foi registrada.

## Pendências do dono

Decisões e passos manuais que esperam o dono.

## Próximos passos

Em ordem.

## Notas do ambiente

Repositórios, rede, ferramentas, armadilhas encontradas.

## Prompt para a próxima sessão

Texto pronto para colar.
```
