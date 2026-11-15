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
- Planos gratuitos da Cloudflare e do GitHub.

## Política de privacidade

Publicada em `/privacidade` (issue #4, 15/11/2026), antes do pedido do Starter. Texto curto, em linguagem simples, com estas 10 seções. O texto diz só a verdade da etapa atual: o site não coleta dados do visitante, e tudo que depende do conector Garmin vem marcado "Ainda não ativo", descrevendo o compromisso. **Antes de qualquer dado real entrar, a política é atualizada, com nova data.**

1. Quais dados: atividades, FC, HRV, sono, estresse e perfil de treino vindos da Garmin. Sem senha, nome completo ou GPS na etapa 1. Também o e-mail usado para entrar, só para avisos sobre a conta (issue #21).
2. Para quê e por quanto tempo: só calcular e explicar as métricas do próprio atleta. Nada é vendido, compartilhado ou usado para publicidade. Os dados ficam até o atleta apagar a conta ou até 24 meses sem uso ("uso" é entrar no app; a sincronização automática não conta), com aviso por e-mail antes (revisão de 15/11/2026, issue #21). Desconectar a Garmin não apaga o histórico.
3. Base legal: **consentimento específico e destacado** (LGPD, dado de saúde é dado sensível), em tela própria no primeiro acesso.
4. Onde ficam e como são protegidos: Cloudflare, possivelmente fora do Brasil (transferência internacional informada). Como são protegidos e como o titular é avisado de incidente de segurança (LGPD, art. 48).
5. IA: Workers AI recebe só números calculados, sem nome nem e-mail.
6. Credenciais Garmin: na etapa 1, no cofre; na etapa 2, token criptografado apagado ao desconectar a Garmin (o histórico já importado fica).
7. Direitos: lista do art. 18 da LGPD; ver, baixar e apagar tudo com um clique; revogar na Garmin. "Apagar minha conta" apaga tudo no app na hora e equivale a revogar o consentimento; prazo de resposta de 15 dias para pedidos por e-mail; frase dos menores de 18 anos (issue #21). Cópias técnicas de segurança levam até 30 dias para sumir (ver a rodada de ajustes da issue #21, abaixo).
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
- Workers Logs desligados (decisão do dono): o projeto não guarda registros de quem visita. Se forem ligados, a política muda antes.
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

Cópias de segurança podem levar um tempo para sumir por completo; a política informa "até 30 dias" (ver abaixo).

Nesta etapa só o texto da política muda (`/privacidade`). Tudo que depende do conector continua marcado "Ainda não ativo". A data da política (`config.ts`) segue 15/11/2026: a revisão é do mesmo dia.

### Rodada de ajustes de 15/11/2026 (issue #21, revisões jurídica e de UX do PR #23)

Decisões do dono nesta rodada, como complemento da revisão acima:

1. **Cópias de segurança: "até 30 dias".** O D1 Time Travel guarda 7 dias no plano Free e 30 no Paid, segundo páginas diferentes da Cloudflare; a política usa o maior número. O número real não consta na issue #5: conferir o plano e o armazenamento dos arquivos .FIT (R2) ali e encurtar o prazo se for o caso. Esse prazo precisa estar certo antes de qualquer dado real, ou seja, na #5.
2. **"Uso" nos 24 meses = entrar no app.** A sincronização automática não conta.
3. **E-mail:** a seção 1 da política passa a citar o e-mail usado para entrar, só para avisos sobre a conta (aviso antes de apagar por falta de uso, aviso de incidente, confirmação de exclusão). Não é usado para publicidade.
4. **Revogação por e-mail** é tratada como "Apagar minha conta": feita em até 15 dias, com confirmação por e-mail ao terminar.

Ajustes de texto (sem decisão nova):

- "Também avisamos a Garmin de que você desconectou" saiu do presente. A política diz "Na etapa seguinte (ainda não ativa), também avisaremos a Garmin...". A referência correta é a especificação OAuth2 PKCE da Garmin (acima), não o "acordo da Garmin".
- "Apagar minha conta" diz "no app", fica junto da ressalva das cópias (até 30 dias), diz que não dá para desfazer e que a pessoa poderá baixar uma cópia antes.
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
