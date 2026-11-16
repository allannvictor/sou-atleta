# Seu normal (recuperação: HRV, FC de repouso e sono)

## O que mostra

A faixa em que o seu próprio corpo costuma ficar, e onde você está hoje dentro dela: "Sua FC de repouso hoje: 53 bpm. Está acima do seu normal (de 47 a 52 bpm)". Vale para HRV, FC de repouso e sono.

## Fórmula

Para cada sinal, com as medidas dos **30 dias anteriores a hoje** (hoje fica de fora, para não se comparar consigo mesmo):

- `média` = média das medidas;
- `desvio` = desvio padrão amostral (divisor n − 1);
- `Seu normal` = de `média − desvio` até `média + desvio`.

Posição de um valor: **abaixo** se for menor que o mínimo; **acima** se for maior que o máximo; **dentro** caso contrário (os limites contam como dentro).

Exemplo (FC de repouso): média 49 bpm, desvio 2,5 → faixa 46,5 a 51,5, mostrada como **47 a 52**. Hoje 53 → "4 bpm acima da sua média de 30 dias, acima do seu normal".

**O que se compara com o normal (D1 da issue #38):**

- **HRV:** a média dos últimos 7 dias, contando hoje (a média de uma semana é mais estável que uma noite só).
- **FC de repouso:** o valor de hoje.
- **Sono:** a noite passada e a média dos últimos 7 dias.

A média dos 7 dias só vale com **pelo menos 3 medidas** dentro da janela.

## Dados de entrada

- HRV: `dia_hrv.hrv_noite_ms` (`lastNightAvg`), em ms.
- FC de repouso: `dia_resumo.fc_repouso`, em bpm, com `fc_repouso_origem`.
- Sono: `dia_sono.sono_s`, o total da noite, em segundos (o dia é o em que você acorda).

Dia sem medida é ignorado e **nunca vira zero**. Valores zero ou negativos da Garmin ("sem dados") também não viram medida. Sem tabela nova e sem migração.

## Fonte científica

- Buchheit, M. Monitoring training status with HR measures: do all roads lead to Rome? _Frontiers in Physiology_ 5:73, 2014. DOI 10.3389/fphys.2014.00073 (conferido em 16/11/2026).
- Plews, D. J.; Laursen, P. B.; Kilding, A. E.; Buchheit, M. Evaluating training adaptation with heart-rate measures: a methodological comparison. _International Journal of Sports Physiology and Performance_ 8(6):688-691, 2013 (existência, autores e conclusão conferidos no resumo em 16/11/2026: a média de uma semana representa melhor que um dia isolado). O mínimo de 3 medidas por semana vem da tese de doutorado de Plews (Auckland University of Technology), não do artigo.

A faixa de "média ± 1 desvio padrão" sobre a própria linha de base do atleta é a prática descrita nessas fontes; a escolha dos 30 dias e dos 21 dias mínimos é decisão do projeto (0003 e issue #38).

## Limites de validade

- **Conhecendo você:** o normal só existe com **21 medidas** nos 30 dias anteriores (D2). Antes disso a tela diz quantos dias faltam ("faltam 6 dias de dados de sono para formar seu normal"). Como hoje fica de fora, quem acabou de começar a usar o relógio leva 22 dias.
- **HRV de pulso só como tendência:** comparada apenas com o próprio normal, nunca com valores de referência de outras pessoas (0003). Em ms, sem logaritmo (D3): a HRV costuma ser assimétrica, e a literatura usa o logaritmo; o revisor de métricas pode pedir essa mudança depois.
- **FC de repouso** mostra a origem (pulso ou cinta) quando a Garmin informa; sem a informação, não mostra nada.
- **Sono só pelo total** (D6): as fases ficam de fora, porque o sensor de pulso erra mais nelas.
- Viagem, doença, álcool e noite mal dormida mexem nos três sinais. O texto **descreve** e nunca explica a causa (D5): ao lado do normal, a tela mostra os 7 dias recentes.
- Se o desvio padrão for muito pequeno (medidas quase iguais), qualquer variação sai da faixa. Não há piso para o desvio; o revisor de métricas pode pedir um.
- O estado da HRV da Garmin ("Balanced", "Low") fica fora (D7): é o tradutor da Garmin, fase seguinte.
- A tela mostra a recuperação junto com a carga. Quem tem dados de sono e HRV, mas nenhuma atividade, ainda vê só "dados ainda estão chegando".

## Invariantes para testes de propriedade

- A faixa sempre contém a média e o desvio nunca é negativo.
- Somar uma constante a todas as medidas desloca a média e não muda o desvio.
- Dias sem medida não mudam o resultado (não viram zero).
- Com menos de 21 medidas, o resultado é sempre "Conhecendo você", com os dias que faltam.
- Hoje e medidas com mais de 30 dias ficam fora do normal.

## Como explicar

- "Sua FC de repouso hoje: 53 bpm. Está acima do seu normal (de 47 a 52 bpm): 4 bpm acima da sua média de 30 dias."
- "Seu sono na última noite: 6 h 30 min. Está abaixo do seu normal (de 6 h 31 min a 7 h 30 min)."
- "Conhecendo você: faltam 6 dias de dados de sono para formar seu normal."
