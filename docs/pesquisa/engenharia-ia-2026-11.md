# Pesquisa de Engenharia de IA (15/11/2026)

Feita pelo agente de Engenharia de IA. A documentação da Cloudflare não pôde ser lida diretamente na hora (domínio bloqueado no ambiente); os números vêm de trechos de busca e espelhos. **Confirmar na documentação oficial antes de implementar.**

## Workers AI: cota gratuita

- 10.000 neurons por dia, zerando às 00:00 UTC. Sem cobrança de excedente no plano gratuito: as chamadas falham até o dia virar. [Verificado em fonte]
- Conversão: US$ 0,011 por 1.000 neurons. [Verificado em fonte]

Estimativa para um texto típico (cerca de 2.500 tokens de entrada e 500 de saída) [Inferência]:

| Modelo                                                   | Neurons por texto | Textos por dia |
| -------------------------------------------------------- | ----------------- | -------------- |
| Gemma 4 26B A4B (substituto recomendado pela Cloudflare) | cerca de 36       | cerca de 275   |
| Mistral Small 3.1 24B                                    | cerca de 105      | cerca de 95    |
| Llama 3.3 70B fp8-fast                                   | cerca de 170      | cerca de 59    |

Com 3 textos por usuário por dia e 20% de retentativas, o Gemma 4 consome cerca de 130 neurons por dia para 1 usuário, 1.300 para 10 e 6.500 para 50. Desligar o "modo de raciocínio" do Gemma 4.

## Aposentadoria de modelos

Em 20/11/2026 a Cloudflare aposenta 24 modelos (entre eles o Llama 3.1 8B fp8); chamadas a eles passam a dar erro 410. Houve três ondas assim em 2026. [Verificado em fonte]

## LoRA na Workers AI

- Lista de modelos com LoRA (abril/2025): Gemma 3 12B (já marcado como descontinuado), Mistral Small 3.1 24B, Llama 3.2 11B Vision, Qwen2.5-Coder 32B, QwQ 32B (aposentado em 20/11). Não há sinal de LoRA para o Gemma 4. [Verificado]
- Limites: posto até 32, arquivo safetensors até 300 MB, modelo base não quantizado. [Verificado]
- A Cloudflare avisou que modelos LoRA "podem ser descontinuados no futuro". [Verificado]
- Subir: `npx wrangler ai finetune create <modelo> <nome> <pasta>` e chamar o modelo com `lora: "<nome>"`. [Verificado]

## Treino gratuito

- Kaggle: cerca de 30 horas de GPU por semana (T4 16 GB ou P100), sessões de até 12 horas. Colab gratuito: T4, até 12 horas, sem garantia. [Verificado, valores flutuam]
- Mistral Small 24B não cabe numa T4 para treino. Gemma 3 12B é viável com QLoRA. [Verificado / Inferência]
- O modelo base do treino precisa ser exatamente o mesmo servido na Workers AI.

## Licenças para usar saídas no treino

- Gemma 4: Apache 2.0, sem restrição. [Verificado]
- Llama 3.1: permite, com exigências de nome e selo ao distribuir. [Verificado]
- Llama 3.3, Qwen e termos da Workers AI: conferir antes de usar.

## Avaliação sem custo

- No CI, sem IA: validadores, bateria sobre saídas gravadas, lista de termos proibidos ("deve", "recomendo", "tente", "evite"), conferência de cada número contra os fatos, legibilidade (frases de até cerca de 20 palavras; Flesch adaptado ao português acima de 50). [Inferência]
- Com IA: cerca de 40 cenários por semana, cerca de 3.000 neurons, com teto fixo.
- Regressão: notas de referência no repositório; um PR que mude pedido ou modelo só passa se a reprovação não subir mais de 2 pontos percentuais e a nota não cair.

## Privacidade

A Cloudflare declara que não usa o conteúdo dos clientes para treinar modelos sem consentimento. [Verificado] Houve incidente em ago–set/2026: o modelo GLM-5.3 vazou dados de outros clientes em 155 respostas; a Cloudflare diz que outros modelos não foram afetados. [Fonte secundária]

## Fontes

- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/features/fine-tunes/loras/
- https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/
- https://developers.cloudflare.com/changelog/post/2026-04-04-gemma-4-26b-a4b-workers-ai
- https://developers.cloudflare.com/workers-ai/platform/privacy/
- https://www.eweek.com/news/cloudflare-ai-data-leak/
- https://opensource.googleblog.com/2026/03/gemma-4-expanding-the-gemmaverse-with-apache-20.html
- https://ai.meta.com/blog/meta-llama-3-1/
- https://unsloth.ai/blog/mistral-small-3.1
