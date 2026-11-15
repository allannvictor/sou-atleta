# Métricas

Um arquivo por métrica, escrito **antes** do código. O mesmo documento serve a três usos:

1. O revisor de métricas confere o código contra ele.
2. O `narrative` o envia ao modelo para explicar a métrica.
3. A aba "Como calculamos" mostra o conteúdo ao atleta.

## Modelo

Copie para `docs/metricas/<nome-da-metrica>.md`:

```markdown
# <Nome no app> (<nome técnico>)

## O que mostra

Uma ou duas frases em linguagem simples, como o atleta vai ler.

## Fórmula

A fórmula exata, com unidades e constantes. Exemplo numérico resolvido.

## Dados de entrada

Quais dados da Garmin (endpoint e campo) e o que acontece quando faltam.

## Fonte científica

Referência completa e link.

## Limites de validade

Quando a métrica erra ou não deve ser mostrada. Como a confiança é calculada.

## Invariantes para testes de propriedade

Propriedades que sempre valem (faixas, monotonicidade, ida e volta).

## Como explicar

Frases de exemplo no tom do app, sem recomendar nada.
```
