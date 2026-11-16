# Base, Carga recente e Saldo (CTL, ATL e TSB)

## O que mostra

- **Base:** quanto treino você sustenta no longo prazo.
- **Carga recente:** quanto treino pesou nos últimos dias.
- **Saldo:** a Base menos a Carga recente. Saldo negativo: a Carga recente está acima da Base. Positivo: abaixo.

## Fórmula

Carga diária = soma das cargas do dia (dia sem treino = 0). Média móvel exponencial:

- `Base_hoje = Base_ontem + (carga_hoje − Base_ontem) / 42`
- `CargaRecente_hoje = CargaRecente_ontem + (carga_hoje − CargaRecente_ontem) / 7`
- `Saldo_hoje = Base_ontem − CargaRecente_ontem` (valores ao fim de ontem; decisão D4: descreve "como você chega hoje" e não muda com o treino do dia)

Exemplo: Base ontem 40, carga hoje 132 → 40 + 92/42 = **42,2**. Carga recente ontem 50 → 50 + 82/7 = **61,7**. Saldo = 40 − 50 = **−10**.

**Valor de partida (D3):** média da carga diária dos primeiros 42 dias dos dados (Base) e dos primeiros 7 (Carga recente). Partir de zero deixaria cerca de 11% de erro mesmo depois dos 90 dias importados (0,976^90 ≈ 11%, conta nossa).

## Dados de entrada

Carga do treino de cada atividade (ver `carga-do-treino.md`), de todas as modalidades. A série vai do começo da janela de atividades importada (`progresso_importacao.inicio`) até hoje.

## Fonte científica

- Calvert, T. W.; Banister, E. W.; Savage, M. V.; Bach, T. A systems model of the effects of training on physical performance. _IEEE Transactions on Systems, Man, and Cybernetics_ SMC-6(2):94-102, 1976 (conferido em 16/11/2026). O modelo de impulso e resposta de Banister é anterior (1975); título e periódico dessa publicação não foram conferidos.
- Allen, H.; Coggan, A. _Training and Racing with a Power Meter_. 2. ed. VeloPress, 2010 (Performance Manager Chart, constantes de 42 e 7 dias). Não conferido nesta data.

## Limites de validade

- **Conhecendo você:** com menos de 42 dias de dados a Base ainda se forma; a tela avisa quantos dias faltam.
- A importação traz só 90 dias (0002): Base e Carga recente começam de uma estimativa (D3), não do histórico real.
- Enquanto a importação dos 90 dias não termina, os números ainda mudam; a tela avisa.
- Treinos sem FC ficam fora da carga e, portanto, da Base.
- As constantes 42 e 7 são convenção do método, não valores individuais.

## Invariantes para testes de propriedade

- Com carga constante, Base e Carga recente ficam iguais à carga e o Saldo é zero.
- Saldo de um dia = Base − Carga recente do dia anterior.
- Base e Carga recente ficam entre 0 e a maior carga diária.
- Um dia sem treino nunca aumenta a Base nem a Carga recente.
- Um treino forte move a Carga recente pelo menos tanto quanto a Base.

## Como explicar

- "Sua Base subiu 8% em relação à semana passada."
- "Sua Carga recente está 20% acima da sua Base. Isso aparece como Saldo negativo."
- "Conhecendo você: faltam 12 dias de dados para sua Base ficar completa."
