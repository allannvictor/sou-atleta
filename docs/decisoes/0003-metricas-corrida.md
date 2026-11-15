# 0003: Métricas da corrida

Cada métrica precisa de um documento próprio em `docs/metricas/` antes de virar código (modelo em `docs/metricas/README.md`).

## Momento atual (saída A)

| Métrica                     | O que mostra                                       | Cálculo                                                                      | Dados da Garmin                                                           |
| --------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Carga do treino             | Quanto cada treino pesou                           | TRIMP por zonas (método de Edwards), usando as zonas de FC da própria Garmin | Duração e tempo em zona (FC média no início; FC segundo a segundo depois) |
| Base (CTL)                  | Carga sustentada no longo prazo                    | Média móvel exponencial de 42 dias da carga                                  | Histórico de atividades                                                   |
| Carga recente (ATL)         | Carga recente                                      | Média móvel exponencial de 7 dias                                            | Histórico de atividades                                                   |
| Saldo (TSB)                 | Cansaço recente contra condicionamento             | Base menos carga recente                                                     | Histórico de atividades                                                   |
| Variação da carga           | Semana atual contra a média das 6 anteriores, em % | Comparação simples                                                           | Histórico de atividades                                                   |
| Volume e consistência       | km, tempo e treinos por semana, com tendência      | Somas e médias móveis                                                        | Atividades                                                                |
| Distribuição de intensidade | Tempo em cada zona de FC                           | Zonas da Garmin                                                              | Atividades                                                                |
| Recuperação                 | HRV, FC de repouso e sono contra o seu normal      | Média e desvio padrão dos últimos 30 dias                                    | Resumos diários de saúde                                                  |

## Por que TRIMP por zonas

A fórmula de Banister usa coeficiente por sexo biológico, e o app não quer perguntar nada ao atleta. O TRIMP por zonas usa as zonas que a Garmin já definiu, o que também deixa nossos números coerentes com o que o atleta vê no relógio.

## Decisões de método

- **Sem previsão de risco de lesão.** A razão carga aguda/crônica (ACWR) como preditor de lesão é contestada na literatura (Impellizzeri e colegas). Mostramos só a variação percentual da carga.
- **FC de pulso tem selo de confiança.** O sensor de pulso erra mais em tiros e intervalos curtos; esses treinos recebem aviso de estimativa menos precisa. Cada dado de FC guarda a fonte (pulso ou cinta) e o nível de confiança.
- **HRV de pulso só como tendência.** Ela sai sistematicamente diferente da medida por ECG; comparamos só com o próprio normal do atleta, nunca com valores absolutos de referência.
- **Período "Conhecendo você" visível** enquanto a linha de base se forma ("faltam 9 dias de dados de sono para formar seu normal").
- **Cada métrica responde "por que mudou?"** apontando os dados de origem.

## Previsões de prova (saída B)

- 5, 10 e 21 km: fórmula de Riegel e VDOT de Jack Daniels lado a lado, com faixa de tempo, não número único.
- 42 km: a fórmula de Riegel erra a maratona em 10 minutos ou mais para metade dos amadores (Vickers e Vertosick, 2016). A previsão também considera volume semanal e longões, no estilo do Marathon Shape do Runalyze, e sempre mostra aviso de que a estimativa tende a ser otimista.
- Nível de confiança explícito, que depende da quantidade de dados disponíveis.
