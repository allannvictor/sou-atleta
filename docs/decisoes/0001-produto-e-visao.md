# 0001: Produto, visão e linguagem

## Visão

O Sou Atleta não substitui o Garmin Connect nem o Strava. Ele usa os dados dessas fontes, incluindo as métricas que a própria Garmin calcula, como matéria-prima para uma visão diferente, feita de três ângulos combinados:

1. **O porquê:** cada número responde "por que mudou?", apontando os treinos e dias de origem.
2. **Você contra você:** comparação com a semana passada, o mês passado e a mesma época do ano anterior.
3. **Tradutor da Garmin:** os rótulos da Garmin (Training Status, Training Effect, Body Battery, HRV Status) explicados no caso do atleta.

Duas abas complementam: **Sua história** (narrativa da semana e do mês) e **Como calculamos** (método, fonte de cada parâmetro, faixa de incerteza e confiança).

## Regra central: descrever, nunca recomendar

O app descreve e estima. Não recomenda treino, não prescreve, não julga e não substitui nenhum profissional. Essa regra é garantida por checagem automática na saída de textos (ver 0004), não só por instrução.

## Saídas, na ordem de construção

| Ordem | Saída                                  | Observação                                                                |
| ----- | -------------------------------------- | ------------------------------------------------------------------------- |
| A     | Momento atual                          | Base de tudo; B, C e D usam os mesmos cálculos                            |
| B     | Previsões de prova (5, 10, 21 e 42 km) | Faixa e confiança; maratona com ajuste por volume e longões               |
| C     | Relatórios semanal e mensal            | Primeiro ponto em que a IA entra                                          |
| D     | Cards para redes sociais               | Formato 9:16, identidade e evolução pessoal, retrospectiva anual gratuita |

Esporte inicial: corrida de asfalto. A estrutura deve permitir ciclismo, natação e triatlo depois.

## Linguagem

1. Frases curtas, sem jargão. Termo técnico inevitável vem explicado na primeira vez.
2. Números sempre com comparação ("22% acima do seu normal"), nunca soltos.
3. Descrever, nunca julgar nem mandar.
4. Tratamento por "você", tom de parceiro de treino que entende de dados.

### Nomes das métricas

| Conceito técnico                            | Nome no app     |
| ------------------------------------------- | --------------- |
| CTL (condicionamento de longo prazo)        | Base            |
| ATL (cansaço recente)                       | Carga recente   |
| TSB (equilíbrio)                            | Saldo           |
| Faixa normal pessoal de HRV e FC de repouso | Seu normal      |
| Período de calibração da linha de base      | Conhecendo você |
