# 0007: Privacidade, conformidade e nome

## Nome

**Sou Atleta.** Escolhido por ser uma afirmação de identidade, inclusiva para o corredor amador, e por ficar mais distante da marca "Eu Atleta" da Globo. Não foi encontrado app ou marca com o nome exato em 15/11/2026, mas é uma expressão comum, o que pode dificultar registro. **Consultar o INPI antes da fase pública.**

Nada de "Garmin" ou "Strava" no nome: as regras de marca da Garmin restringem esse uso.

## Projeto fechado e não comercial

O projeto é fechado e não comercial. Quando o dono avisar que vai virar comercial, ou quando a evolução do projeto mudar algo nos termos, nos custos ou na lei, os agentes avisam o dono antes de seguir. Lista do que revisar nessa hora:

- Nível da Garmin (Personal → Starter → Enterprise) e custo por usuário acima de cerca de 1.000 usuários.
- Termos do Strava sobre IA e exibição de dados.
- Registro da marca no INPI.
- Revisão da política de privacidade e dos termos por advogado.
- Planos gratuitos da Cloudflare e do GitHub. Os prazos da política (cópias de segurança em 7 dias, registros da sync em 3 dias) valem só no plano gratuito: mudar de plano manda a política para revisão.

## Política de privacidade

Publicada em `/privacidade` (issue #4, 15/11/2026), antes do pedido do Starter. Texto curto, em linguagem simples, com estas 10 seções. O texto diz só a verdade da etapa atual: o site não coleta dados do visitante, e tudo que depende do conector Garmin vem marcado "Ainda não ativo", descrevendo o compromisso. **Antes de qualquer dado real entrar, a política é atualizada, com nova data.**

1. Quais dados: atividades, FC, HRV, sono, estresse e perfil de treino vindos da Garmin. Sem senha, nome completo ou GPS na etapa 1. Também o e-mail usado para entrar, só para avisos sobre a conta (issue #21).
2. Para quê e por quanto tempo: só calcular e explicar as métricas do próprio atleta. Nada é vendido, compartilhado ou usado para publicidade. Os dados ficam até o atleta apagar a conta ou até 24 meses sem uso ("uso" é entrar no app; a sincronização automática não conta), com aviso por e-mail antes (revisão de 15/11/2026, issue #21). Desconectar a Garmin não apaga o histórico.
3. Base legal: **consentimento específico e destacado** (LGPD, dado de saúde é dado sensível), em tela própria no primeiro acesso.
4. Onde ficam e como são protegidos: Cloudflare, possivelmente fora do Brasil (transferência internacional informada). Como são protegidos e como o titular é avisado de incidente de segurança (LGPD, art. 48).
5. IA: Workers AI recebe só números calculados, sem nome nem e-mail.
6. Credenciais Garmin: na etapa 1, no cofre; na etapa 2, token criptografado apagado ao desconectar a Garmin (o histórico já importado fica).
7. Direitos: lista do art. 18 da LGPD; ver, baixar e apagar tudo com um clique; revogar na Garmin. "Apagar minha conta" apaga tudo no app na hora e equivale a revogar o consentimento; prazo de resposta de 15 dias para pedidos por e-mail; frase dos menores de 18 anos (issue #21). Cópias técnicas de segurança levam até 7 dias para sumir (revisão de 16/11/2026, issue #5; antes dizia 30).
8. Compartilhamento: cards só saem quando o atleta decide.
9. Aviso de responsabilidade: o app descreve e estima, não recomenda treino e não substitui profissional.
10. Contato do responsável (e-mail do projeto, `souatletaapp@gmail.com`) e data da última atualização.

## Decisões

- Idade mínima: **18 anos** (a política diz "pessoas com 18 anos ou mais").
- ~~Ao desconectar ou sair: apagar todos os dados imediatamente.~~ **Substituída** pela revisão de 15/11/2026 (issue #21), abaixo: sair, desconectar a Garmin e apagar a conta são três ações diferentes.
- Contato público: e-mail próprio do projeto, **`souatletaapp@gmail.com`**, visível publicamente no site e na política.
- Responsável pelo tratamento identificado **só pelo e-mail do projeto, sem nome** (decisão do dono, 15/11/2026, issue #4). A LGPD pede identificar o controlador; o e-mail basta neste estágio. Rever com o advogado antes da fase pública.

## Revisão de 15/11/2026 (issue #4)

- Política publicada no site fechado, em `/privacidade`, com a página inicial `/` também pública. Só `/app` fica atrás do Cloudflare Access.
- E-mail do projeto definido (`souatletaapp@gmail.com`) e responsável identificado só por ele.
- A política cita o cookie de sessão do Cloudflare Access (`CF_Authorization`), usado apenas na área fechada. As páginas públicas não definem cookies.
- Workers Logs desligados (decisão do dono): o projeto não guarda registros de quem visita. Se forem ligados, a política muda antes. (Revisão de 16/11/2026: ligados só na Worker de sincronização; ver abaixo.)
- Rodada de ajustes (mesma data): 18 anos ou mais, lista dos direitos do art. 18, retenção, proteção, aviso de incidente, exclusão sem prometer o impossível com cópias de segurança, menos jargão.
- Texto escrito por agente, sem advogado. A revisão por advogado continua na lista do "Projeto fechado e não comercial", antes da fase pública.

## Revisão de 15/11/2026 (issue #21)

Substitui a decisão "Ao desconectar ou sair: apagar todos os dados imediatamente". O motivo: "sair" pode ser lido como encerrar a sessão, e isso apagaria dados sem querer; e quem desconecta a Garmin por um tempo não deveria recomeçar do zero. Decisões do dono, com a pesquisa do agente jurídico sobre os termos da Garmin e a LGPD:

1. **Sair, desconectar e apagar conta são coisas diferentes.**
   - **Sair** só encerra a sessão. Nunca apaga dados.
   - **Desconectar a Garmin** para a sincronização e apaga a chave/token, mas **mantém o histórico já importado**. Na etapa 2, também avisa a Garmin (desregistro). Fonte: a especificação OAuth2 PKCE da Garmin, seção "Delete User Registration" (<https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf>, PDF de 23/07/2025), diz que esse endpoint deve ser chamado quando o app oferece "Delete My Account" ou "Disconnect" fora do processo normal de remoção de consentimento da Garmin. Não confirmamos o que o acordo do Starter, que não é público, diz além disso.
   - **Apagar minha conta** apaga tudo, imediatamente, e equivale a revogar o consentimento (LGPD, art. 8º, § 5º, e art. 18, VI).
   - Tudo isso vale só para a cópia dos dados no banco do app (D1). **Nada é apagado na Garmin.**
2. **Menores:** a política diz "Se soubermos que alguém com menos de 18 anos se cadastrou, apagamos os dados."
3. **Prazo de resposta:** "Respondemos em até 15 dias, ou antes, se a lei exigir prazo menor."
4. **Inatividade:** os dados ficam até a pessoa apagar a conta ou até **24 meses sem uso**, com aviso por e-mail antes de apagar.

Cópias de segurança podem levar um tempo para sumir por completo; a política informa "até 30 dias" (**substituído em 16/11/2026: "até 7 dias", ver a revisão da issue #5, abaixo**).

Nesta etapa só o texto da política muda (`/privacidade`). Tudo que depende do conector continua marcado "Ainda não ativo". A data da política (`config.ts`) segue 15/11/2026: a revisão é do mesmo dia.

### Rodada de ajustes de 15/11/2026 (issue #21, revisões jurídica e de UX do PR #23)

Decisões do dono nesta rodada, como complemento da revisão acima:

1. **Cópias de segurança: "até 30 dias"** (**substituído em 16/11/2026 por "até 7 dias", decisão A da issue #5, abaixo**). O D1 Time Travel guarda 7 dias no plano Free e 30 no Paid, segundo páginas diferentes da Cloudflare; a política usa o maior número. O número real não consta na issue #5: conferir o plano e o armazenamento dos arquivos .FIT (R2) ali e encurtar o prazo se for o caso. Esse prazo precisa estar certo antes de qualquer dado real, ou seja, na #5.
2. **"Uso" nos 24 meses = entrar no app.** A sincronização automática não conta.
3. **E-mail:** a seção 1 da política passa a citar o e-mail usado para entrar, só para avisos sobre a conta (aviso antes de apagar por falta de uso, aviso de incidente, confirmação de exclusão). Não é usado para publicidade.
4. **Revogação por e-mail** é tratada como "Apagar minha conta": feita em até 15 dias, com confirmação por e-mail ao terminar.

Ajustes de texto (sem decisão nova):

- "Também avisamos a Garmin de que você desconectou" saiu do presente. A política diz "Na etapa seguinte (ainda não ativa), também avisaremos a Garmin...". A referência correta é a especificação OAuth2 PKCE da Garmin (acima), não o "acordo da Garmin".
- "Apagar minha conta" diz "no app", fica junto da ressalva das cópias (até 30 dias; **hoje, "até 7 dias"**), diz que não dá para desfazer e que a pessoa poderá baixar uma cópia antes.
- Quem desconecta fica sabendo que, para apagar o histórico, usa "Apagar minha conta". "Revogar o acesso na própria Garmin" é explicado: não é uma ação do app, é tirar a permissão pelo site ou app da Garmin; o histórico guardado no app continua até a conta ser apagada.
- Termos explicados na primeira vez (sessão, sincronização, chave de acesso); "importado" virou "que já veio da Garmin".
- O Resumo ganhou um quadro das três ações com link para a seção 7; as seções 2, 3 e 7 deixam o texto completo na 7. O prazo de 15 dias vale para pedidos por e-mail. A política diz como avisar sobre menores (e-mail do projeto). Referências de seção viram links. A etiqueta "Ainda não ativo" tem texto extra para leitor de tela. Vocabulário: "Conectar a Garmin" / "Desconectar a Garmin".

Pendências que seguem para a revisão por advogado (#17) ou para a etapa 2: se manter o histórico após desconectar cabe no acordo da Garmin (conferir antes do pedido do Starter) e na LGPD (necessidade e fim do tratamento); intervalo entre o aviso de inatividade e a exclusão (a política ainda não dá número); se a política deve antecipar a escolha "só parar" ou "parar e apagar tudo"; lei dos menores em ambiente digital.

### Condições para a etapa 2 (não entram agora)

- Tela de consentimento citando a retenção após desconectar.
- Tela de desconexão com a escolha "só parar" ou "parar e apagar tudo".
- Chamada do desregistro da Garmin.
- Aviso por e-mail antes de apagar por inatividade, e o e-mail guardado só para avisos da conta (inclusive no consentimento).
- Revisão por advogado (#17).
- Reler o acordo da Garmin vigente no pedido do Starter.

## Revisão de 16/11/2026 (issue #5)

Decisões do dono no comentário da issue #5 (15/11/2026), aplicadas no PR do conector.

### A. Cópias de segurança: "até 7 dias" (no lugar de "até 30 dias")

A conta da Cloudflare está no **plano gratuito**. A página de limites do D1 (atualizada em 30/10/2026) diz: Time Travel de 7 dias no Workers Free e 30 no Workers Paid. A política (seção 7, "Apagar minha conta") passa a dizer "até 7 dias", com nova data (16 de novembro de 2026), e os testes impedem a volta de "30 dias". **Se a conta passar para o plano pago, a política volta para revisão** (o prazo real passa a 30 dias). Os arquivos .FIT no R2, quando entrarem, precisam de conferência própria.

### B. Workers Logs só na Worker de sincronização

- Ligados só em `apps/sync` (retenção de 3 dias no plano gratuito); o site continua com logs desligados, e a política segue dizendo que o site não guarda registros de quem o visita.
- A política (resumo e seção 4) passou a dizer, em linguagem simples e marcado "Ainda não ativo" até a rotina ser ligada (**o gatilho é publicar a Worker `sync`**, passo 5 do passo a passo da 0005, antes de existir chave): a rotina de sincronização guarda registros de eventos técnicos por 3 dias, no serviço de registros da Cloudflare; eles dizem só o que aconteceu; nunca levam a chave, a autorização temporária da Garmin nem dados de saúde.
- Garantias técnicas e testes: ver a revisão de 16/11/2026 da decisão 0005.
- Os registros automáticos de cada invocação ficam desligados na `sync` (decisão de engenharia, não do dono; reversível).

### TRAVA: não cadastrar a chave antes da política revista e da #22 (decisão do dono, 16/11/2026)

> **NÃO cadastre a chave (o passo de `wrangler secret put GARMIN_API_KEY`) antes de a política revista e a issue #22 (pelo menos "Apagar minha conta" e "Desconectar a Garmin") estarem mescladas.**

A trava também é **mecânica**: `POLITICA_REVISTA` em `apps/sync/wrangler.jsonc` começa em `"nao"`, e a sync não fala com a Garmin enquanto não for `"sim"`; ela só muda no PR que fechar a #29, depois da #22 (0005). A política completa para o conector ativo fica **num PR separado (#29)**, e a #22 vem depois dela. Este PR (issue #5) só mudou o que o dono decidiu: cópias de segurança em 7 dias, os registros da sincronização e a data. O texto sobre a conexão com a Garmin, o consentimento e "ver, baixar e apagar" continua marcado "Ainda não ativo", e o conector fica inerte (sem chave, sem dado) até a trava ser liberada.

### Pendências para o PR da política (nova issue)

Reunidas das revisões jurídica e de segurança do PR da #5, para o agente jurídico e o dono:

- **Reescrever a política para o que passa a ser verdade com a chave** (Resumo e seções 1, 2, 3, 4, 6 e 7): "ainda não está conectado" e "ainda não trata dados de saúde" deixam de valer; a seção 7 hoje diz que "o site não guarda dados seus"; manter "Ainda não ativo" só no que continua futuro (tela de consentimento, ver e baixar, IA, cards, etapa 2).
- **Seção 1 ("Quais dados"):** hoje diz "atividades de corrida"; o conector guarda atividades de **todas as modalidades** (decisão do dono, 0002) e também VO2max, Training Effect, Body Battery, FC de repouso e limiar, zonas de FC, fuso horário, dias de treino preferidos e hora de início. O fuso horário e o par hora local/GMT revelam a região aproximada. Dizer que a importação inicial traz só os **últimos 3 meses** e que o app só atualiza quando é aberto.
- **"Uso" nos 24 meses:** diz que "a sincronização automática não conta"; agora a sincronização só roda ao abrir o app, então entrar é o único uso. "24 meses sem uso" e "aviso por e-mail" não existem em código: dizer o que existe (apagamento manual, a pedido).
- Dizer que o **Cloudflare Access registra logins** (e-mail, IP e país; a página do Access não informa a retenção), hoje a política diz que "o projeto não guarda".
- **Transferência internacional** (LGPD, arts. 33 a 36): começa quando a chave entra; o D1 criado sem dica de localização fica onde a Cloudflare escolher. O aviso precisa estar na política antes disso.
- **Consentimento:** na etapa 1 só o dono usa o app, com os próprios dados; dizer a verdade (sem tela de consentimento ainda).
- **Termos da Garmin** (só o dono viu): registrar em comentário na #5, sem copiar o texto, a data da leitura e um sim ou não para guardar cópia dos dados, processar em provedor de nuvem, uso em análise ou IA, mostrar em cards, apagar se a chave for revogada, regras de marca. Qualquer "não" ou "não sei" precisa de advogado.
- **Linguagem do Resumo:** unificar "registros de funcionamento" e "registros de eventos técnicos"; separar a frase da sync em item próprio; trocar "lote" por "pedaço dos seus dados".
- **Apagar conta (#22):** a chave é um segredo da Worker; o app não a apaga sem um token da API da Cloudflare (risco novo para a segurança decidir). Se "Desconectar" só marcar "desconectada" e parar de usar a chave, o dono a remove à mão e o texto diz isso. "Apagar tudo" cobre as 8 tabelas e não promete apagar o que está fora do app (logins no Access, Time Travel por 7 dias).
- Precisa de advogado (#17): se a LGPD alcança o tratamento do próprio dono em uso particular (art. 4º, I) e, se alcançar, se a política e o consentimento em tela são exigidos já na etapa 1; a transferência internacional e sua base jurídica.

### Antes de liberar amigos (etapa 2)

Além das condições da etapa 2 acima: **não liberar nenhum e-mail de amigo em `/app` antes de existir isolamento por usuário** no banco (o D1 é de um dono só). Registrado também na 0005.

## Revisão de 16/11/2026 (issue #22): Sair, Desconectar a Garmin e Apagar minha conta

Especificação aprovada pelo dono em 16/11/2026. A tela é `/app/conta`, atrás do Access.

- **Sair** é o link `/cdn-cgi/access/logout` do próprio site (documentação da Cloudflare, "session management"). Encerra a sessão do Access, inclusive nas outras aplicações da conta, e não apaga nada.
- **Desconectar a Garmin (etapa 1)** é uma página guiada, não um botão que muda estado: o dono apaga a chave no Garmin Connect (a Garmin a invalida na hora, segundo o FAQ da Personal API) e remove os dois segredos com `wrangler secret delete`. O app não tem, e não ganha, um token da Cloudflare com poder sobre segredos. O histórico fica. Na etapa 2 (OAuth) vira botão, com o desregistro da Garmin.
- **Apagar minha conta** só funciona **com a chave já ausente do cofre**, para a próxima abertura de `/app` não reimportar os 90 dias. Quem apaga é a Worker `sync` (`POST /apagar-tudo`, só por ligação interna): as 8 tabelas, numa transação. O site só pede. Também recusa enquanto a trava da sincronização estiver viva (até 5 minutos): uma execução em andamento, inclusive de uma versão antiga da Worker que ainda tinha a chave, gravaria dados de volta depois do "tudo apagado" (achado M1 da revisão de segurança do PR #41). A confirmação é digitar `APAGAR`, e o formulário exige o `Origin` do próprio site. Um teste compara a lista de tabelas apagadas com as das migrações: tabela nova precisa nascer apagável.
- **O que não é apagado**, e a tela diz: o que está na Garmin; os registros de login do Cloudflare Access; as cópias de segurança do banco (até 7 dias); os registros técnicos da `sync` (até 3 dias, sem dado de saúde). O log guarda só `dados_apagados` com o número de tabelas.
- A tela mostra, para o passo de remover o segredo, os comandos só num bloco "Detalhes técnicos": na etapa 1 quem faz é o dono; na etapa 2 vira botão e os comandos somem.
- Limite conhecido (achado B4): o resultado vem na URL (`?apagar=`), então um link forjado mostraria a mensagem "Pronto" sem apagar nada. É só engano visual; app de um usuário só.
- Arquivos no R2 ainda não existem; quando entrarem, entram na lista de apagar.
