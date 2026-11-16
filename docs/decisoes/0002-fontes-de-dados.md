# 0002: Fontes de dados

## Etapas

| Etapa | Quem usa                                   | Garmin                                                                           | Strava                                                      |
| ----- | ------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1     | Só o dono do projeto                       | Chave pessoal (Garmin Connect Personal API)                                      | Não                                                         |
| 2     | Dono e amigos (beta fechado)               | Login "Conectar a Garmin" pelo nível Starter do Garmin Connect Developer Program | Não                                                         |
| 3     | Público                                    | Starter, depois Enterprise                                                       | Só cálculos, sem IA, após confirmação por escrito do Strava |
| 4     | App mobile, outros esportes, outras fontes |                                                                                  |                                                             |

## Garmin, etapa 1

- A chave pessoal serve para o próprio dono acessar os próprios dados. O FAQ oficial diz que ela "não é destinada a aplicações comerciais que atendem vários usuários". Por isso amigos só entram na etapa 2.
- A chave fica no cofre de segredos da Cloudflare, nunca em banco, log ou arquivo. Validade escolhida: 180 dias.
- Sincronização ao abrir a área fechada e pelo botão "Atualizar agora" (sem rotina agendada: ver a revisão de 16/11/2026).
- Importação inicial dos últimos 90 dias (revisão de 16/11/2026; antes: todo o histórico). Resumos JSON primeiro; arquivos .FIT completos depois, no R2.
- Fatos oficiais (FAQ da Personal API): a chave aparece uma única vez; validade de 30, 90, 180 ou 365 dias; o token de acesso dura 24 horas, sem refresh token; o dono pode revogar a qualquer momento. Esses comportamentos viram testes do conector.

## Garmin, etapa 2

- O dono pede o nível Starter (gratuito, com aprovação, cerca de 1.000 usuários segundo reportagens) depois do primeiro deploy, porque o pedido exige site e política de privacidade publicados.
- O conector separa autenticação do resto. Trocar a chave pessoal pelo OAuth troca só essa peça.
- Acima de cerca de 1.000 usuários a Garmin cobra (nível Enterprise). Avisar o dono antes de chegar perto.

## Tudo vem da Garmin

O atleta não digita nada que a Garmin já sabe. Confirmado na especificação oficial da Personal API: zonas de FC (com a FC máxima, de repouso e de limiar usadas), perfil, VO2max e Training Effect por atividade, HRV, sono, Body Battery, estresse. O app mostra a origem de cada parâmetro ("FC máxima 188, da sua configuração Garmin"). O atleta pode ajustar um valor se quiser, nunca é obrigado.

## Strava

- O acordo de API do Strava (atualização de junho de 2026, segundo reportagens) proíbe usar os dados "no desenvolvimento, treinamento, avaliação ou operação de qualquer aplicação de IA" e restringe exibir dados de um atleta para outros.
- Quando entrar (etapa 3), dados do Strava alimentam só cálculos e gráficos. Cada dado carrega a fonte, e uma checagem automática impede que dado do Strava chegue ao `narrative`.
- Pedir confirmação por escrito ao Strava antes de lançar.

## Duplicidade

Quem usa Garmin quase sempre sincroniza com o Strava. Quando as duas fontes coexistirem, a mesma atividade precisa ser identificada e unificada.

## Revisão de 16/11/2026 (issue #5): limites da Garmin conferidos

A especificação oficial (Swagger da Personal API) não traz limite de requisições nem resposta 429; traz só o tamanho máximo de janela de alguns endpoints (sono 31 dias, estresse 28, resumo diário 1 ano). O conector usa folgas conservadoras próprias e trata qualquer 429 como "espere". Detalhes, fatos separados de inferências: `docs/pesquisa/garmin-limites-api-2026-11.md`. O estresse e o Body Battery vêm do resumo diário (um pedido por até um ano), e a origem da FC (pulso ou cinta) só é marcada quando a Garmin lista o sensor; sem isso, fica `desconhecido`.

## Revisão de 16/11/2026 (issue #5): sem rotina agendada, 90 dias, todas as modalidades

Decisões do dono, 16/11/2026.

1. **Sem Cron Trigger.** A sincronização acontece quando o dono abre `/app` (pedido em segundo plano, no máximo a cada 10 minutos) e quando aperta "Atualizar agora" (que ignora o intervalo, mas respeita a pausa por 429). Detalhes técnicos na 0005. Consequência: o app só se atualiza quando é aberto.
2. **Importação inicial de 90 dias, não de todo o histórico.** Depois, é incremental: busca desde a última sincronização, relendo 3 dias para atividades editadas. Enquanto os 90 dias não terminam, cada abertura ou clique traz o próximo pedaço, e o quadro mostra o andamento. **Consequência:** a comparação com "a mesma época do ano anterior" (0001) só fica disponível depois de um ano de uso, e a linha de base de HRV e sono só se forma com os dados dos últimos meses. Isto substitui "todo o histórico disponível" da especificação da issue #5 (critério 7 passa a ser: fixture com mais de um lote dentro dos 90 dias, interromper e retomar sem duplicar).
3. **Guardar atividades de TODAS as modalidades**, sem filtrar por corrida. Motivo: Base, Carga recente e Saldo (0003) medem a carga do corpo inteiro, e uma pedalada ou uma natação pesa na recuperação. O app descreve corrida em primeiro lugar (0001), mas a carga conta todas. O campo `tipo` da atividade guarda a modalidade. A política de privacidade ainda diz "atividades de corrida" e precisa ser corrigida no PR da política (0007).
4. O estresse e o Body Battery vêm do resumo diário, e a origem da FC (pulso ou cinta) só é marcada quando a Garmin lista o sensor; sem isso, fica `desconhecido` (mantido pelo dono).
