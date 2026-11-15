# Garmin e Strava: acesso e termos (15/11/2026)

## Garmin Connect Personal API (lido na página oficial)

- Para "usuários individuais que querem acesso programático aos próprios dados", em "aplicações pessoais". "Não é destinada a aplicações comerciais que atendem vários usuários."
- Fluxo: criar a chave no Garmin Connect Web, aceitar os Termos e Condições, escolher validade (30, 90, 180 dias ou 1 ano). A chave aparece uma única vez.
- A chave é trocada por um token de acesso no endpoint `personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token`. O token vale 24 horas ou até a chave expirar. Sem refresh token.
- A chave pode ser apagada a qualquer momento; tokens associados deixam de funcionar.
- Endpoints confirmados na especificação oficial: atividades (lista, detalhe, download do .FIT), zonas de FC (`/biometric-service/heartRateZones/v2`, com FC máxima, de repouso e de limiar usadas), perfil (`/userprofile-service/userprofile/settings`), HRV diária, sono, Body Battery, estresse, FC diária, passos, peso, Fitness Age. Por atividade: VO2max, Training Effect aeróbico e anaeróbico com classificação, limiar de lactato, dinâmica de corrida.
- Não confirmado: se o sexo biológico vem no perfil; o texto dos Termos e Condições (fica atrás do login).

Fonte: https://developer.garmin.com/gc-developer-program/personal/personal-api/ e o FAQ e a documentação Swagger na mesma seção.

## Garmin Connect Developer Program (reportagens)

- Desde outubro de 2026: Personal (grátis, sem aprovação), Starter (grátis, com aprovação, cerca de 1.000 usuários) e Enterprise (US$ 1.000 de entrada mais valor por usuário ativo; cobrança a partir de abril de 2027). A Garmin não publica preços.
- O acordo de desenvolvedor não permite compartilhar a chave com terceiros sem permissão escrita (reportado; não lido no original).

Fontes: https://www.dcrainmaker.com/2026/10/garmin-connect-api-revamps-connect-developer.html, https://sahha.ai/blog/garmin-connect-api-reopened-fees/, https://garminrumors.com/garmin-connect-developer-program-personal-starter-enterprise/

## Strava (reportagens)

- Acordo de 2024: proíbe usar dados da API para treinar modelos de IA e limita a exibição dos dados de um atleta ao próprio atleta.
- Atualização de junho de 2026: proíbe usar os dados "no desenvolvimento, treinamento, avaliação ou operação de qualquer aplicação de IA". A palavra "operação" provavelmente cobre gerar texto com IA a partir dos dados.
- Apps novos ficam limitados a 1 atleta conectado até a revisão do Strava.
- Recomendado pedir orientação por escrito ao Strava antes de usar dados com IA.

Fontes: https://techrepublic.com/article/news-strava-api-scraping-crackdown, https://sahha.ai/blog/health-api-ai-restrictions/, https://dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html
