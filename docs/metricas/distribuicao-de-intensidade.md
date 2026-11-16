# Distribuição de intensidade

## O que mostra

Que parte do seu tempo de treino dos últimos 28 dias ficou em cada zona de FC, da 1 à 5.

## Fórmula

`percentual da zona i = segundos na zona i ÷ segundos em todas as zonas × 100`, somando as atividades dos últimos 28 dias (contando hoje) que têm tempo em zona informado pela Garmin, de todas as modalidades. Os cinco percentuais somam 100.

Exemplo: 600, 600, 1.200, 0 e 0 segundos → 25%, 25%, 50%, 0% e 0%.

## Dados de entrada

`atividade.tempo_zona1_s` a `tempo_zona5_s`. Atividade sem tempo em zona não entra (e não é estimada aqui). Sem nenhum tempo em zona, a distribuição não é mostrada.

## Fonte científica

Soma e proporção simples dos tempos em zona informados pela Garmin.

## Limites de validade

- As zonas são as da Garmin (podem ser por FC máxima, reserva ou limiar); a comparação é com as suas zonas.
- FC de pulso erra mais em intervalados curtos (0003).
- Mostra o que aconteceu; não diz qual distribuição é "a certa".

## Invariantes para testes de propriedade

- Os percentuais somam 100 e ficam entre 0 e 100.
- Atividades fora dos 28 dias não entram.

## Como explicar

- "Nos últimos 28 dias, 62% do seu tempo foi na zona 2 e 8% nas zonas 4 e 5."
