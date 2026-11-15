# 0004: IA gratuita

## Princípios

1. **O app funciona 100% sem IA.** Números, explicações básicas, "por que mudou", "Seu normal" e o tradutor da Garmin em versão simples saem do código por modelos de texto. A IA deixa a linguagem mais rica: aba "Sua história", relatórios, explicações mais naturais.
2. **Custo zero em execução.** Se a IA falhar ou a cota acabar, o app usa os modelos de texto e nada quebra.
3. **Provedor único: Cloudflare Workers AI**, no plano gratuito. Os dados de saúde não saem da Cloudflare. Nenhum outro provedor, nem como reserva.

## Escolha do modelo

Medida pela bateria de avaliação, não por palpite. O identificador do modelo fica numa configuração, com um substituto já testado. Candidato inicial pela pesquisa de 15/11/2026: Gemma 4 26B A4B (barato, licença Apache 2.0, bom em português). Ver `docs/pesquisa/engenharia-ia-2026-11.md`.

## Como um texto é gerado

1. O `core` gera os **fatos**: números calculados, cada um com um identificador.
2. O `narrative` monta o pedido: fatos, documento da métrica, regras de tom (0001) e exemplos de bons textos. Sem nome, e-mail ou GPS.
3. O modelo responde em formato estruturado, frase a frase, citando os fatos que usou. **O modelo nunca escreve números:** ele escreve marcadores como `{f12}` e o código insere o valor.
4. Checagens automáticas: sem linguagem prescritiva, nenhum fato inventado, frases curtas.
5. Se reprovar: uma nova tentativa; se falhar de novo, entra o modelo de texto.
6. Os textos são gerados na sincronização e guardados. Abrir o app não gasta cota.

## Ensinar o modelo: em etapas

| Etapa | Técnica                                                                                      | Quando                                            |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 0     | Modelos de texto, validadores e bateria de avaliação, sem IA                                 | Primeiro                                          |
| 1     | Exemplos no pedido (few-shot), resposta estruturada, documento da métrica pelo identificador | Quando a saída C começar                          |
| 2     | Medir por 4 a 8 semanas                                                                      | Depois da etapa 1                                 |
| 3     | Ajuste fino LoRA                                                                             | Só se as condições abaixo forem todas verdadeiras |

Condições para o LoRA:

- Reprovação na primeira tentativa acima de 15%, ou uso do modelo de texto acima de 5%, depois de 3 rodadas de melhoria dos exemplos.
- Existir na Workers AI um modelo base com suporte a LoRA, não descontinuado, bom em português e treinável nas GPUs gratuitas (Kaggle ou Colab).
- Nota da bateria estagnada.

Dados de treino: só sintéticos, gerados pelo `core`. Nunca dados do Strava. Dados reais de usuários só com consentimento explícito.

## Bateria de avaliação

- Cenários artificiais de atleta gerados pelo `core`: semana de pico, volta de pausa, calibração, recordes e outros.
- Verifica propriedades, não texto fixo: passa nas checagens, cita os fatos principais, é fácil de ler.
- No CI a cada PR: só checagens determinísticas sobre saídas gravadas, sem chamar o modelo.
- Com o modelo: rodada semanal com teto fixo de cota.
- Um PR que mude pedido ou modelo só passa se a reprovação não subir e a nota não cair.

## Cota e riscos

- Cota gratuita: 10.000 neurons por dia, zerando à meia-noite UTC. Estimativa: cerca de 275 textos por dia com o Gemma 4. A avaliação gasta da mesma cota.
- O plano gratuito não cobra excedente: as chamadas falham e o app usa os modelos de texto.
- A Cloudflare aposenta modelos em ondas (24 modelos em 20/11/2026). O agente de Engenharia de IA confere a página de mudanças toda semana.
- Privacidade: a Cloudflare declara não usar os dados de inferência para treino. Houve incidente com um modelo recém-lançado em 2026; evitamos modelos muito novos e mandamos o mínimo de dados.
