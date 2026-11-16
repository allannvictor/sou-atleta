# Volume e consistência

## O que mostra

Por semana (segunda a domingo): quantos km de corrida, quanto tempo de treino e quantos treinos você fez, nas últimas 8 semanas completas e na semana em andamento, com a tendência.

## Fórmula

- Semana de calendário, de segunda a domingo (data local da atividade).
- **km de corrida:** soma de `distancia_m ÷ 1000` das atividades de corrida (D6): `tipo` contendo `running` ou `run` (rua, esteira, trilha, pista). Pedal, natação e outros esportes não entram nos km.
- **Tempo e treinos:** de todas as modalidades.
- **Tendência:** variação percentual da média das 4 semanas completas mais recentes contra as 4 anteriores, para cada um dos três números. A semana em andamento não entra.

Exemplo: 10 km por semana nas 4 semanas anteriores e 15 nas 4 recentes → **+50%**.

## Dados de entrada

`atividade`: `data_local`, `tipo`, `duracao_s`, `distancia_m`. Sem as 8 semanas completas de dados, a tendência não é mostrada ("Conhecendo você"). Sem nada nas 4 semanas anteriores, a variação daquele número não é mostrada.

## Fonte científica

Somas e médias simples; sem fórmula de terceiros.

## Limites de validade

- A semana em andamento sempre parece menor: a tela marca "em andamento".
- Importação ainda incompleta mostra semanas vazias que não são ausência de treino: a tela avisa.

## Invariantes para testes de propriedade

- Domingo fica na semana que termina nele; segunda abre a seguinte.
- Km só somam atividades de corrida.
- Há sempre 8 semanas completas e 1 em andamento.

## Como explicar

- "Na semana passada você correu 32 km em 4 treinos."
- "Nas últimas 4 semanas, a média de km de corrida está 50% acima das 4 anteriores."
