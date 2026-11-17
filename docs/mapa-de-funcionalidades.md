# Mapa de funcionalidades

Vocabulário comum entre o dono e os agentes. Quando alguém disser "a tela Seu normal", todos sabem o que é. Atualizado pelo agente de produto a cada funcionalidade nova.

Situação: **planejado**, salvo onde estiver marcado **no ar** ou **implementado**. Hoje só as páginas do site abaixo existem.

## Site

| Página                      | Endereço        | Acesso                            | Situação                                                                                                                                                                                       |
| --------------------------- | --------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Início**                  | `/`             | Pública                           | Implementado (issue #4). No ar após o primeiro deploy. Diz o que o app vai oferecer nos três ângulos (no futuro: ele ainda não funciona), o que ele não faz e que está em fase fechada.        |
| **Política de privacidade** | `/privacidade`  | Pública                           | Implementado (issues #4 e #21). As 10 seções da decisão 0007, com data de atualização; o que depende da Garmin vem como "Ainda não ativo". Separa sair, desconectar a Garmin e apagar a conta. |
| **Área fechada**            | `/app` e abaixo | Só o dono, pelo Cloudflare Access | Implementado (issue #4). Hoje é uma tela de teste ("Você está dentro"). A Worker recusa quem não tem JWT válido do Access. As telas abaixo vão morar aqui.                                     |

## Momento atual (tela principal)

- **Como você está:** Base, Carga recente, Saldo, variação da carga, recuperação. Cada item com "por que mudou?".
- **Você contra você:** o mesmo dado contra a semana passada, o mês passado e a mesma época do ano anterior.
- **O que a Garmin está dizendo:** Training Status, Training Effect, Body Battery e HRV Status traduzidos.
- **Conhecendo você:** aviso de calibração enquanto a linha de base se forma.

## Abas

- **Sua história:** narrativa da semana e do mês, gerada pela IA a partir de fatos calculados.
- **Como calculamos:** método, fonte de cada parâmetro, faixa de incerteza e confiança.
- **Previsões:** 5, 10, 21 e 42 km, com faixa, confiança e evolução.
- **Relatórios:** semanal e mensal.
- **Cards:** imagens 9:16 para redes sociais, retrospectiva anual.

## Conta e dados

- **Conexão Garmin:** etapa 1 com a chave do dono no cofre; etapa 2 com "Conectar a Garmin". Conector implementado na issue #5 (aviso da chave e importação do histórico no quadro "Sua conta Garmin" da área fechada); entra em uso quando o dono cadastrar a chave.
- **Atualizar agora:** busca dados novos fora da rotina agendada. Implementado na issue #5, como botão do quadro "Sua conta Garmin" em `/app`. Abrir `/app` também pede a sincronização (no máximo a cada 10 minutos); não há rotina agendada.
- **Sua conta** (`/app/conta`): Sair, Desconectar a Garmin (página guiada na etapa 1) e Apagar minha conta. Implementado na issue #22.
- **Seus dados:** ver e baixar (planejado). Apagar tudo já existe em "Sua conta".
- **Consentimento:** tela própria no primeiro acesso.
