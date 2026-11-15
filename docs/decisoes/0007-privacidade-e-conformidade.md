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

1. Quais dados: atividades, FC, HRV, sono, estresse e perfil de treino vindos da Garmin. Sem senha, nome completo ou GPS na etapa 1.
2. Para quê e por quanto tempo: só calcular e explicar as métricas do próprio atleta. Nada é vendido, compartilhado ou usado para publicidade. Os dados ficam até o atleta apagar ou desconectar.
3. Base legal: **consentimento específico e destacado** (LGPD, dado de saúde é dado sensível), em tela própria no primeiro acesso.
4. Onde ficam e como são protegidos: Cloudflare, possivelmente fora do Brasil (transferência internacional informada). Como são protegidos e como o titular é avisado de incidente de segurança (LGPD, art. 48).
5. IA: Workers AI recebe só números calculados, sem nome nem e-mail.
6. Credenciais Garmin: na etapa 1, no cofre; na etapa 2, token criptografado apagado ao desconectar.
7. Direitos: lista do art. 18 da LGPD; ver, baixar e apagar tudo com um clique; revogar na Garmin. A exclusão é imediata no app; cópias técnicas de segurança podem levar um tempo para sumir (prazo a medir e informar antes de qualquer dado real).
8. Compartilhamento: cards só saem quando o atleta decide.
9. Aviso de responsabilidade: o app descreve e estima, não recomenda treino e não substitui profissional.
10. Contato do responsável (e-mail do projeto, `souatletaapp@gmail.com`) e data da última atualização.

## Decisões

- Idade mínima: **18 anos** (a política diz "pessoas com 18 anos ou mais").
- Ao desconectar ou sair: **apagar todos os dados imediatamente**.
- Contato público: e-mail próprio do projeto, **`souatletaapp@gmail.com`**, visível publicamente no site e na política.
- Responsável pelo tratamento identificado **só pelo e-mail do projeto, sem nome** (decisão do dono, 15/11/2026, issue #4). A LGPD pede identificar o controlador; o e-mail basta neste estágio. Rever com o advogado antes da fase pública.

## Revisão de 15/11/2026 (issue #4)

- Política publicada no site fechado, em `/privacidade`, com a página inicial `/` também pública. Só `/app` fica atrás do Cloudflare Access.
- E-mail do projeto definido (`souatletaapp@gmail.com`) e responsável identificado só por ele.
- A política cita o cookie de sessão do Cloudflare Access (`CF_Authorization`), usado apenas na área fechada. As páginas públicas não definem cookies.
- Workers Logs desligados (decisão do dono): o projeto não guarda registros de quem visita. Se forem ligados, a política muda antes.
- Rodada de ajustes (mesma data): 18 anos ou mais, lista dos direitos do art. 18, retenção, proteção, aviso de incidente, exclusão sem prometer o impossível com cópias de segurança, menos jargão.
- Texto escrito por agente, sem advogado. A revisão por advogado continua na lista do "Projeto fechado e não comercial", antes da fase pública.
