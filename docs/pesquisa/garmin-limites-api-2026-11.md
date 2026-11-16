# Garmin Personal API: limites, janelas e formato (conferido em 15 e 16/11/2026)

Pesquisa da issue #5. Separa o que a Garmin **publica** (fato) do que **escolhemos ou supomos** (inferência). O valor de cada constante do código está no fim.

## Como foi conferido

A página `https://developer.garmin.com/gc-developer-program/personal/swagger-docs/` é uma interface Swagger montada por script. A especificação OpenAPI 3.0.1 ("Garmin Connect Personal API", versão 1.0.0, servidores `personal.connectapi.garmin.com` e `.cn`) vem embutida no JavaScript da página. Foi extraída dali e lida inteira (26 caminhos). Também foram lidas a página da Personal API, o FAQ da Personal API e a visão geral do programa (`/gc-developer-program/overview/`). Os Termos e Condições da chave ficam atrás do login; o dono os leu (comentário da issue #5).

## Fatos (publicados pela Garmin)

### Limite de requisições

- **Nenhum valor de taxa, cota ou número de requisições por tempo aparece** na especificação, na página da Personal API, no FAQ nem na visão geral. A visão geral só diz, para a Personal: entrega "Pull only", sem limite de capacidade nem de histórico declarado.
- **Nenhuma resposta 429 é documentada**, e nenhum cabeçalho `Retry-After`. A especificação lista só 200, 204, 400, 401, 403, 404 e 500.

### Tamanho máximo de janela de datas (escrito na especificação)

| Endpoint                                                   | Máximo documentado                                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/sleep-service/sleep/dailySleepSummariesByDate`           | 31 dias                                                                                                     |
| `/wellness-service/wellness/bodyBattery/reports/daily`     | 31 dias                                                                                                     |
| `/usersummary-service/stats/hydration/daily/{start}/{end}` | 31 dias                                                                                                     |
| `/usersummary-service/stats/steps/daily/{start}/{end}`     | 28 dias                                                                                                     |
| `/usersummary-service/stats/stress/daily/{start}/{end}`    | 28 dias                                                                                                     |
| `/usersummary-service/v2/dailysummaries`                   | 1 ano                                                                                                       |
| `/hrv-service/hrv/daily/{from}/{to}`                       | **não informado**                                                                                           |
| `/activitylist-service/activities/search/activities`       | **não informado** (paginação por `start` e `limit`, padrão 99; datas inclusivas, pela hora local de início) |

### Chave e token

- Troca: `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token` com o cabeçalho `Authorization: ApiKey [chave]`.
- O token vale 24 horas, ou até a chave expirar. Não há refresh token: pede-se outro na mesma chamada.
- A chave aparece uma única vez; validade de 30, 90, 180 dias ou 1 ano; pode ser apagada a qualquer momento (a chave e os tokens dela deixam de valer).
- A Garmin manda e-mail cerca de uma semana antes de a chave vencer.

### Dados disponíveis que usamos

- Atividades (lista): `activityId`, `startTimeLocal`, `startTimeGMT`, `activityType.typeKey`, `duration`, `distance`, `averageHR`, `maxHR`, `hrTimeInZone_1` a `_5`, `vO2MaxValue`, `aerobicTrainingEffect`, `anaerobicTrainingEffect`.
- Zonas de FC (`/biometric-service/heartRateZones/v2`): `zone1Floor` a `zone5Floor`, `maxHeartRateUsed`, `restingHeartRateUsed`, `lactateThresholdHeartRateUsed`, `trainingMethod`, `sport`.
- Perfil (`/userprofile-service/userprofile/settings`): `measurementSystem`, `timeZone`, `availableTrainingDays`, `preferredLongTrainingDays`. **Não traz FC máxima nem sexo biológico** (a FC máxima vem das zonas).
- HRV por dia (`hrvSummaries`): `calendarDate`, `lastNightAvg`, `weeklyAvg`, `lastNight5MinHigh`, `status`. Sem dados: HTTP 204.
- Sono por dia: `calendarDate`, `sleepTimeSeconds`, `deepSleepSeconds`, `lightSleepSeconds`, `remSleepSeconds`, `awakeSleepSeconds`.
- Resumo diário v2 (um pedido por até 1 ano): FC de repouso (`heartRate.restingValue`), estresse (`stress.avgLevel`, `maxLevel`) e Body Battery (`bodyBattery.minValue`, `maxValue`, `chargedValue`, `drainedValue`, `endOfDayValue`). **Por isso o conector não usa os endpoints separados de estresse e de Body Battery**: o resumo diário já entrega os dois com muito menos requisições.
- Sensores da atividade (`/activity-service/activity/{id}`, `metadataDTO.sensors`): `sourceType`, `antplusDeviceType`, `bleDeviceType`, `localDeviceType`. A descrição da Garmin diz que a lista **ignora os sensores embutidos e o aparelho que gravou a atividade**.
- A resposta traz também latitude e longitude de início e fim, nome do local, nome completo, nome de exibição e foto do dono. O conector descarta tudo isso na entrada.

### Não publicado (não confirmado)

- O corpo da resposta da troca de token (nomes dos campos e se traz a validade).
- Como o token é enviado nas chamadas de dados (o esquema de autorização não está declarado na especificação).

## Inferências e escolhas nossas (não são limites da Garmin)

1. **Token enviado como `Authorization: Bearer <token>`**: padrão do mercado, não confirmado. Se a primeira sincronização real responder 401 mesmo com chave boa, é aqui que se ajusta.
2. **Resposta da troca de token** aceita `{access_token, expires_in}` ou `{accessToken, expiresIn}`; sem validade informada, assume 24 h menos 5 min. Fora desses formatos, o erro é claro e não se inventa token.
3. **Pausa de 1,5 s entre requisições** (no máximo 40 por minuto). Sem taxa publicada, é uma folga conservadora para uma conta pessoal.
4. **Janelas**: atividades 14 dias, resumo diário 30 dias, sono 10 dias, HRV 14 dias. Onde há máximo documentado ficamos em menos da metade dele (sono 10 de 31; resumo 30 de 365). Onde não há (atividades e HRV), ficamos em 14 dias, a metade da menor janela documentada (28). Janelas pequenas também mantêm cada execução dentro de 10 ms de CPU do plano gratuito da Cloudflare.
5. **429**: como a Garmin não documenta, tratamos qualquer 429 como "espere": para a execução na hora, grava a pausa (o `Retry-After` quando houver, entre 1 s e 6 h; senão 15 min; dobrando a cada 429 seguido até 6 h) e não fala com a Garmin até ela passar. Sem repetição em laço.
6. **Pulso x cinta**: sensor externo de FC (ANT+ ou Bluetooth) listado ⇒ `cinta`. Sensor local `WHR` listado ⇒ `pulso`. **Sem nenhum dos dois ⇒ `desconhecido`**, porque a Garmin diz que não lista sensores embutidos: a falta de cinta na lista não prova que foi o pulso. Consequência provável: muitas atividades de pulso ficarão `desconhecido`. Pergunta para o dono e para o agente de métricas: aceitar "sem cinta listada = pulso" seria uma suposição; não foi feita.
7. **Início do histórico**: a atividade mais antiga da conta (um pedido, `sortOrder=asc&limit=1`); dados de saúde começam 60 dias antes; conta sem atividades começa 90 dias atrás.
8. **A FC de repouso do resumo diário** é marcada `desconhecido` quanto ao sensor: a Garmin não informa.

## Constantes no código

`packages/garmin/src/limites.ts` (conector) e `apps/sync/src/limites.ts` (orçamento por execução). Os testes conferem que as janelas ficam abaixo dos máximos documentados, que a pausa entre requisições é respeitada e que um 429 faz esperar em vez de repetir.

## Limites da Cloudflare (plano gratuito) que moldam o desenho

Conferidos em `developers.cloudflare.com/workers/platform/limits` e `/d1/platform/limits` (D1 atualizada em 30/10/2026):

- 10 ms de CPU por execução, também no Cron Trigger (esperar rede não conta).
- 50 subrequests por execução, somando `fetch` e idas ao D1 (um `batch` conta como uma).
- 5 Cron Triggers por conta; 100 mil requisições por dia.
- D1: 500 MB por banco, 100 parâmetros por consulta, Time Travel de 7 dias.
- Workers Logs: 200 mil eventos por dia, retenção de 3 dias.

O tempo de CPU real **não foi medido** (só dá para medir na Cloudflare). Medição de apoio em Node, com o motor aquecido: ler e validar uma janela custa cerca de 0,5 ms; montar as gravações de uma janela de 30 dias, 1,5 a 2 ms. Isso motivou o teto de 3 janelas por execução do cron e 2 no botão. Conferir nas primeiras execuções reais.
