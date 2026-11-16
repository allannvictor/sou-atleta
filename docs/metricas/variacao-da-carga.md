# Variação da carga

## O que mostra

Quanto a carga dos últimos 7 dias difere da sua média semanal das 6 semanas anteriores: "Sua carga desta semana está 22% acima do seu normal".

## Fórmula

`variação = (soma da carga dos últimos 7 dias ÷ média semanal dos 42 dias anteriores a eles − 1) × 100`.

Os "últimos 7 dias" são móveis, contando hoje (D5): uma semana de calendário mostraria quase −100% toda segunda-feira. As 6 semanas anteriores são os dias 8 a 49 contando para trás a partir de hoje.

Exemplo: 600 nos últimos 7 dias contra média de 500 por semana → (600 ÷ 500 − 1) × 100 = **+20%**.

## Dados de entrada

Carga diária (ver `carga-do-treino.md`). Precisa de pelo menos 49 dias de dados; antes disso a tela mostra "Conhecendo você" com os dias que faltam. Se as 6 semanas anteriores não têm carga nenhuma, não há comparação e o percentual não é mostrado (nada de divisão por zero).

## Fonte científica

Comparação simples entre a semana atual e a média das anteriores. **Não é a razão aguda/crônica (ACWR) como preditor de lesão**, por decisão da 0003: a literatura contesta esse uso (Impellizzeri, F. M.; Tenan, M. S.; Kempton, T.; Novak, A.; Coutts, A. J. Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. _International Journal of Sports Physiology and Performance_ 15(6):907-913, 2020; DOI 10.1123/ijspp.2019-0864, conferido em 16/11/2026).

## Limites de validade

- É só uma descrição. Nunca é apresentada como risco, alerta ou recomendação.
- Semana de férias ou de prova distorce a média das anteriores; o texto não explica a causa.
- Treinos sem FC não entram na carga.

## Invariantes para testes de propriedade

- Carga igual em todas as semanas dá variação zero.
- O percentual nunca fica abaixo de −100%.
- Com menos de 49 dias de dados, o resultado é "conhecendo".

## Como explicar

- "Sua carga dos últimos 7 dias está 22% acima da sua média das 6 semanas anteriores."
- "Conhecendo você: faltam 14 dias de dados para comparar com suas semanas anteriores."
