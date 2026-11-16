# Carga do treino (TRIMP por zonas de Edwards)

## O que mostra

Quanto cada treino pesou, num número só. Minutos em zonas mais fortes pesam mais: "Seu treino de ontem teve carga 132".

## Fórmula

`carga = Σ (minutos na zona i × i)`, para as zonas i = 1 a 5 da Garmin. Tempo abaixo da zona 1 não conta.

Exemplo: 5, 20, 15, 8 e 2 minutos nas zonas 1 a 5 → 5×1 + 20×2 + 15×3 + 8×4 + 2×5 = 5 + 40 + 45 + 32 + 10 = **132**.

Quando a Garmin não informa o tempo em zona (decisão D1, issue #37): todo o tempo da atividade vai para a zona em que cai a FC média, pelos pisos de `zona_fc` do esporte (ou `DEFAULT`). Marcada "estimativa simplificada". FC média abaixo da zona 1 dá carga zero.

## Dados de entrada

- `atividade`: `tempo_zona1_s` a `tempo_zona5_s` (`hrTimeInZone_1..5`), `duracao_s`, `fc_media`, `fc_origem`.
- `zona_fc`: pisos das zonas 1 a 5 (`zone1Floor..zone5Floor`).
- Atividade sem tempo em zona e sem FC média utilizável (ou sem pisos): **fica fora da carga** (D2). A tela diz quantos treinos dos últimos 7 dias ficaram fora.
- Valores negativos ou não numéricos da Garmin são tratados como ausentes.

## Fonte científica

Edwards, S. _The Heart Rate Monitor Book_. Fleet Feet Press (1992 ou 1993, conforme a fonte consultada). Método de soma ponderada do tempo por zona de FC.

**Conferência pendente:** a busca de 16/11/2026 não localizou a tabela de pesos do livro. Os pesos 1 a 5 são os citados na literatura sobre o método de Edwards (por exemplo, protocolos clínicos). O dono ou o revisor de métricas confere no livro. O método é escolhido na decisão 0003 por usar as zonas que a Garmin já definiu (a fórmula de Banister exige coeficiente por sexo biológico).

## Limites de validade

- Edwards definiu as zonas por faixas da FC máxima. A Garmin pode definir por % da FC máxima, da reserva ou do limiar; usamos o número da zona, como o relógio mostra.
- Todas as modalidades entram (0002), mas o peso por zona não distingue o custo de cada esporte.
- **FC de pulso** erra mais em esforços fortes e curtos. Aviso "estimativa com margem de erro maior" quando mais de 20% do tempo em zona está nas zonas 4 e 5 e a FC não é de cinta (D7). A classificação fina de intervalados espera FC segundo a segundo.
- Treino sem FC não entra (D2); o texto avisa.

## Invariantes para testes de propriedade

- A carga nunca é negativa.
- Mais tempo em qualquer zona nunca reduz a carga.
- A carga é a soma dos minutos por zona vezes o número da zona.
- Valores inválidos são ignorados.

## Como explicar

- "Esse treino teve carga 132, a maior da semana."
- "A carga deste treino é uma estimativa simplificada: a Garmin não informou o tempo em cada zona."
- "2 treinos dos últimos 7 dias ficaram fora da carga porque não têm frequência cardíaca."
