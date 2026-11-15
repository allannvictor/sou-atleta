# 0005: Arquitetura e stack

## Stack

| Camada                      | Escolha                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| Linguagem                   | TypeScript no modo mais rígido                                              |
| Monorepo                    | pnpm + Turborepo                                                            |
| Web                         | React + React Router v7 em Cloudflare Workers                               |
| Interface                   | Tailwind + shadcn/ui                                                        |
| Banco                       | Cloudflare D1 (SQLite) + Drizzle ORM                                        |
| Arquivos                    | Cloudflare R2 (arquivos .FIT, mais tarde)                                   |
| Sincronização               | Worker com Cron Trigger                                                     |
| Validação de dados externos | Zod                                                                         |
| IA                          | Cloudflare Workers AI (ver 0004)                                            |
| Testes                      | Vitest, fast-check, Playwright com axe                                      |
| Qualidade                   | ESLint com regras próprias e regras de camadas, Prettier, secretlint        |
| CI                          | GitHub Actions (repositório privado: 2.000 minutos/mês gratuitos)           |
| Acesso fechado (etapa 1)    | Cloudflare Access (gratuito até 50 pessoas)                                 |
| Endereço                    | Worker `sou-atleta`, em `sou-atleta.<subdomínio>.workers.dev` (ver Revisão) |

Tudo no plano gratuito da Cloudflare. Futuro app mobile em React Native/Expo, reaproveitando o `core`.

## Pacotes

```
apps/web            site
apps/sync           rotina de sincronização
packages/core       cálculos puros, um módulo por esporte (corrida primeiro)
packages/garmin     conector Garmin
packages/narrative  IA e checagens de saída
packages/db         esquema e migrações
```

## Regras de camadas

Garantidas pelo ESLint (`eslint.config.js`), não por combinado:

- `core` não importa nenhum pacote do projeto, não usa APIs do Node e não faz rede. Ele roda igual no servidor, na web e no app mobile.
- `narrative` não importa `garmin` nem `db`: só recebe fatos calculados.
- A chave da Garmin só existe dentro de `garmin` e `sync`. Ela terá um tipo próprio que não pode ser gravado nem impresso, mais um teste que manda uma chave falsa pelo fluxo inteiro e verifica que ela não aparece em nenhuma tabela nem log. (A fazer junto com o conector.)
- Todo dado vindo de fora (Garmin, depois Strava) é validado com Zod na entrada.
- Cada dado guarda a fonte de origem, para a regra "Strava nunca chega ao `narrative`" poder ser verificada.

## Versões

Ferramentas fixadas em versões exatas, publicadas há pelo menos duas semanas. TypeScript fica na 6.0 enquanto o typescript-eslint não suportar a 7.

## Revisão de 15/11/2026 (issue #4)

- Endereço definido: um Worker chamado `sou-atleta` em `workers.dev` (não Pages). O subdomínio da conta é escolhido no primeiro deploy. Domínio próprio custa dinheiro e fica fora do escopo.
- Rotas: `/` e `/privacidade` públicas; `/app` e tudo abaixo fechado pelo Cloudflare Access. A própria Worker também valida o JWT do Access em `/app`, para o acesso fechado não depender só do painel.
- Saída do build do `apps/web` em `dist/`, como no resto do monorepo.
- Deploy automático por GitHub Actions ao mesclar na `main`. O job roda no Environment `producao` do GitHub (restrito à `main`), e `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` são **Environment secrets** dele, nunca secrets de repositório (esses chegam a qualquer workflow de qualquer branch). As actions do workflow ficam fixadas por SHA de commit.
- Workers Logs (`observability`) **desligados** e Version URLs (`preview_urls`) desligadas no `wrangler.jsonc`, por decisão do dono. Ligar os logs exige antes atualizar a política de privacidade. Reavaliar com o conector da Garmin (#5).
- Arquivos estáticos nunca são servidos sob `/app`: `assets.run_worker_first` cobre `/app*`, e um teste falha se o build gerar qualquer arquivo que comece com "app".
- React Router fica na **v7** (7.18.x). A documentação da Cloudflare já usa a v8 como padrão; a migração é uma decisão futura, não desta issue.

## Revisão de 15/11/2026: configuração do Access

Registro do que o dono configurou no painel da Cloudflare (passo 7 da issue #4). Aqui só ficam valores públicos; o segredo do cliente do Google existe apenas no painel e nunca vai para o repositório.

- **Aplicação:** auto-hospedada, chamada `sou-atleta`, com três destinos em `sou-atleta.web-souatleta.workers.dev`: `app`, `app.data` e `app/*`. O Access do Worker inteiro não foi usado, para `/` e `/privacidade` continuarem públicas.
- **Política:** Allow `So o dono`, com a regra Emails = `souatletaapp@gmail.com`. Mais ninguém entra.
- **Login:** Google como principal e código por e-mail (One-time PIN) como reserva. O cliente OAuth do Google fica no projeto `sou-atleta-login` (Google Cloud), em modo Testing, com o e-mail do projeto como usuário de teste e PKCE ligado. "Accept all identity providers" está desligado. O login com conta Cloudflare (padrão em times novos) foi desmarcado na aplicação, porque a conta Cloudflare é a de administração. Isso substitui o plano original de "só código por e-mail" (decisão do dono, 15/11/2026).
- **Sessão:** 24 horas. Cookie HttpOnly, SameSite Lax e Binding cookie ligado. O caminho do cookie não é forçado, para a proteção valer também em `/app.data`. App Launcher desligado.
- **Time Zero Trust:** `broad-term-ec6b`, nome gerado automaticamente e mantido por decisão do dono. Trocar o nome exige atualizar os endereços no Google e o `TEAM_DOMAIN` no `wrangler.jsonc`.
- **Valores públicos no código:** `TEAM_DOMAIN` e `POLICY_AUD` em `apps/web/wrangler.jsonc`. A Worker valida o JWT do Access contra eles em `/app`.
- **Pendência:** antes da etapa 2, a política de privacidade passa a mencionar o login pelo Google (o Google fica sabendo de cada login). Revisão do agente jurídico.
