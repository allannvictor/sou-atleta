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
- Workers Logs (`observability`) **desligados** e Version URLs (`preview_urls`) desligadas no `wrangler.jsonc`, por decisão do dono. Ligar os logs exige antes atualizar a política de privacidade. Reavaliado na issue #5: ligados só na Worker de sincronização (ver a revisão de 16/11/2026, abaixo); na Worker do site seguem desligados.
- Arquivos estáticos nunca são servidos sob `/app`: `assets.run_worker_first` cobre `/app*`, e um teste falha se o build gerar qualquer arquivo que comece com "app".
- React Router fica na **v7** (7.18.x). A documentação da Cloudflare já usa a v8 como padrão; a migração é uma decisão futura, não desta issue.

## Revisão de 15/11/2026: configuração do Access

Registro do que o dono configurou no painel da Cloudflare (passo 7 da issue #4). Aqui só ficam valores públicos; o segredo do cliente do Google existe apenas no painel e nunca vai para o repositório.

- **Aplicação:** auto-hospedada, chamada `sou-atleta`, com três destinos em `sou-atleta.web-souatleta.workers.dev`: `app`, `app.data` e `app/*`. O Access do Worker inteiro não foi usado, para `/` e `/privacidade` continuarem públicas.
- **Política:** Allow `So o dono`, com a regra Emails = `souatletaapp@gmail.com`. Mais ninguém entra.
- **Login:** Google como principal e código por e-mail (One-time PIN) como reserva. O cliente OAuth do Google fica no projeto `sou-atleta-login` (Google Cloud), em modo Testing, com o e-mail do projeto como usuário de teste e PKCE ligado. "Accept all identity providers" está desligado. O login com conta Cloudflare (padrão em times novos) foi desmarcado na aplicação, porque a conta Cloudflare é a de administração. Isso substitui o plano original de "só código por e-mail" (decisão do dono, 15/11/2026).
- **Sessão:** 24 horas. Cookie HttpOnly, SameSite Lax e Binding cookie ligado. O caminho do cookie não é forçado, para a proteção valer também em `/app.data`. App Launcher desligado.
- **Time Zero Trust:** `broad-term-ec6b`, nome gerado automaticamente e mantido por decisão do dono. Trocar o nome exige atualizar os endereços no Google e o `TEAM_DOMAIN` no `wrangler.jsonc`.
- **Valores públicos no código:** `TEAM_DOMAIN` e `POLICY_AUD` em `apps/web/wrangler.jsonc`. A Worker valida o JWT do Access contra eles em `/app`. A lista de e-mails permitidos também (ver a seção seguinte).
- **Pendência:** antes da etapa 2, a política de privacidade passa a mencionar o login pelo Google (o Google fica sabendo de cada login). Revisão do agente jurídico.

## Revisão de 15/11/2026: a Worker confere quem entrou (issue #11)

Achado M1 da revisão de segurança do PR #10. Aprovado pelo dono em 15/11/2026 (autenticação, decisão 0006).

- **A validação do e-mail na Worker é obrigatória.** A política do painel ("So o dono") sozinha não basta: se alguém a ampliar por engano (Everyone, "Emails ending in", um grupo), o Access passaria a emitir JWT válido a terceiros. Depois de provar o JWT, a Worker exige que o `email` do token esteja em `EMAILS_PERMITIDOS`. As duas travas devem permanecer; a política do painel continua sendo a primeira.
- **Regras:** comparação sem diferenciar maiúsculas (só A-Z), pelo endereço inteiro: sem curinga, sem "termina em @dominio", sem normalizar pontos ou `+` do Gmail. A lista só aceita endereços inteiros com letras minúsculas (A-Z viram minúsculas antes), dígitos e `. _ % + -` antes do `@`, e domínio com ponto; aspas, `<`, `>`, barra, espaço, curinga e qualquer caractere fora de ASCII tornam a lista inválida (erro de colagem no `wrangler secret put` aparece como 503, não como 403 igual ao de um intruso). E-mail ausente, vazio, que não seja texto ou fora da lista: 403 com a mesma mensagem genérica. Lista ausente, vazia ou com entrada malformada: 503 para quem traz JWT (o dono vê que falta configurar), 403 para quem não traz. O JWT também precisa ter `type` igual a `"app"`.
- **Onde a lista mora:** variável `EMAILS_PERMITIDOS` (e-mails separados por vírgula). **Agora:** em `vars` do `wrangler.jsonc`, só com `souatletaapp@gmail.com`, que já é público. **Quando entrar o primeiro amigo:** passa a ser secret da Worker, sem mudar o código, junto com o consentimento da pessoa e a atualização da política de privacidade (pendência acima). Motivo: o repositório é público e o histórico do git é permanente, e e-mail de amigo é dado pessoal (LGPD, art. 5). Um teste (`app/server/emails-no-wrangler.test.ts`) falha se o `wrangler.jsonc` tiver qualquer e-mail diferente do do projeto, em valor ou em comentário.
- **Como fazer a troca para secret (para o primeiro amigo):** a documentação da Cloudflare diz que secret e variável são a mesma coisa para a Worker (`env`), que o `wrangler deploy` sobrescreve variáveis alteradas no painel e que não apaga secrets. Ela **não diz** o que acontece quando um secret e uma entrada de `vars` têm o mesmo nome. Por isso a troca não pode depender disso: nunca deixe as duas ao mesmo tempo (o teste `emails-no-wrangler.test.ts` também falha se `EMAILS_PERMITIDOS` estiver em `vars` e em `secrets.required` do topo). Passos:
  1. **Tire a linha `EMAILS_PERMITIDOS` só do `vars` do topo (produção).** O ambiente `teste` não herda `vars` nem `secrets` do topo, não é publicado e **mantém a lista dele**, só com o e-mail do projeto. Se a linha sair de lá, os e2e que mandam JWT inválido passam a receber 503 em vez de 403, porque a configuração é conferida antes da assinatura; não "corrija" isso mudando a ordem das checagens. O teste `emails-no-wrangler.test.ts` já aceita os dois estados da produção (lista em `vars`, ou secret declarado em `secrets.required` e sem a linha em `vars`), então não precisa mudar na troca; o valor real de produção deixa de ser validado pelo CI.
  2. **Onde fica o arquivo com os e-mails** (para o `--secrets-file`): de preferência **fora do repositório** (por exemplo `~/sou-atleta-secrets.env`). Se for dentro, só com o nome `apps/web/.env.producao`, que o `.gitignore` já cobre (`.env.*`; confira com `git check-ignore -v apps/web/.env.producao`). Nenhum outro nome dentro do repositório (`secrets.json`, `segredos.env`...): eles não estão no `.gitignore`, o `secretlint` não acusa e-mail e um `git add .` publicaria dado pessoal de terceiro num histórico permanente. **Apague o arquivo logo depois do deploy.**
  3. **Envie o secret.** Sem janela de 503: `wrangler deploy --secrets-file <arquivo>`. Com janela (falha fechada, de propósito): `wrangler secret put EMAILS_PERMITIDOS` **só pelo prompt interativo**; nunca com `echo "a@b,c@d" | wrangler secret put ...` nem outro pipe, que grava a lista no histórico do shell. Cole o valor sem aspas.
  4. **Declare o secret como obrigatório:** `"secrets": { "required": ["EMAILS_PERMITIDOS"] }` no topo do `wrangler.jsonc` faz o deploy falhar com mensagem clara se o secret faltar, em vez de trancar o dono em produção.

  Quem fizer a troca confere o comportamento real num Worker de teste antes e atualiza esta seção.

- **Premissa da checagem de e-mail:** o JWT de aplicação não diz qual provedor de login o emitiu, então a Worker não consegue distinguir. A checagem **supõe que todo provedor de login ligado à aplicação prova a posse do e-mail** (hoje, Google e código por e-mail). Adicionar um provedor à aplicação (OIDC ou SAML genérico, ou religar "Accept all identity providers") exige revisão de segurança antes: um provedor que aceite e-mail não verificado deixaria um terceiro obter JWT com o e-mail do dono e derrubaria as duas travas ao mesmo tempo.
- **`type` "app" não distingue pessoa de token de serviço:** o JWT de token de serviço do Access também pode vir com `type` "app" (com `common_name` e sem `email`). Quem o barra é a falta de e-mail; a checagem de e-mail não pode ser afrouxada achando que o `type` já basta. Há teste com esse formato.
- **O e-mail não é gravado em lugar nenhum:** a Worker só o compara; o resultado continua sendo "permitido" ou "negado". Workers Logs seguem desligados na Worker do site (a Worker de sincronização tem logs próprios; ver a revisão de 16/11/2026).

## Revisão de 16/11/2026 (issue #5): conector Garmin, banco e sincronização

Especificação aprovada pelo dono em 15/11/2026, com as decisões A e B do último comentário da issue. Fatos e inferências sobre a Garmin: `docs/pesquisa/garmin-limites-api-2026-11.md`.

### Pacotes e camadas

- `packages/garmin`: conector (troca a chave por token de 24 h, pede dados, valida tudo com Zod). **Só `apps/sync` o importa.** O tipo `GarminKey` guarda o valor num campo privado e devolve `[REDACTED]` em `toString`, `toJSON`, conversão para texto e inspeção do Node; o token (`GarminToken`) idem e vive só na memória do processo.
- `packages/db`: tabelas (Drizzle), a primeira migração (`migrations/0000_inicial.sql`) e a leitura do estado. Não importa nenhum outro pacote do projeto.
- `apps/sync`: Worker com Cron Trigger (a cada 15 minutos) e `POST /atualizar` (botão "Atualizar agora").
- O lint garante: o site não importa `garmin` nem lê `GARMIN_API_KEY`; `db` e `garmin` não importam outros pacotes do projeto; a Garmin falsa e o banco em memória (`/teste`) só entram em arquivos de teste; só `apps/sync/src/log.ts` pode usar `console`.

### Sem endereço público e sem a chave no site

A Worker `sou-atleta-sync` tem `workers_dev` e `preview_urls` desligados e nenhuma rota. Só a Worker do site chega nela, por **ligação interna** (service binding `SYNC`), depois de o Access e a validação do JWT liberarem `/app`. O botão é um formulário que só aceita pedidos com `Origin` igual ao endereço do site. O site recebe só o banco (leitura) e a ligação `SYNC`, nunca o `env` inteiro e nunca a chave.

### Dois segredos, só por `wrangler secret put` (prompt interativo)

`GARMIN_API_KEY` (a chave) e `GARMIN_CHAVE_VENCE_EM` (a data de vencimento, `AAAA-MM-DD`; a Garmin não informa a data pela API, então o dono a informa para o aviso de 14 dias existir). Sem eles: estado "chave ausente" ou "sem data", com aviso claro; nunca erro silencioso. Chave com aspas ou espaço é recusada como "mal colada" antes de falar com a Garmin.

### O que fica no banco (migração 0000)

`atividade`, `dia_hrv`, `dia_sono`, `dia_resumo`, `zona_fc`, `perfil_treino`, `progresso_importacao`, `sincronizacao_estado`. Cada registro tem `fonte = 'garmin'` (CHECK no banco). Não existe coluna para GPS, local, nome, e-mail, foto, chave ou token (teste confere os nomes). `fc_origem` é `pulso`, `cinta` ou `desconhecido`. O estado guarda só códigos curtos de erro, nunca texto de erro.

### Como a sincronização cabe no plano gratuito

Limites e números em `docs/pesquisa/garmin-limites-api-2026-11.md`. Cada execução: no máximo 40 subrequests (de 50), 20 requisições à Garmin no cron (8 no botão), 3 janelas de datas no cron (2 no botão), pausa de 1,5 s entre requisições. Cada janela e o avanço do progresso entram no D1 no **mesmo `batch`** (uma transação): se algo interromper, a próxima execução retoma dali, sem duplicar nem pular dia. Uma trava no banco (expira em 5 min) impede cron e botão de rodarem juntos. 429: para na hora e grava a pausa. Chave recusada: o cron só tenta de novo daqui a 1 hora; o botão tenta na hora.

### Workers Logs: só na Worker `sync` (decisão B do dono, 15/11/2026)

- `apps/sync/wrangler.jsonc`: `observability` ligado (`head_sampling_rate` 1), com **`invocation_logs: false`**: o registro automático de cada invocação inclui dados da requisição que não controlamos; ficam só os eventos que a própria Worker escreve. Se o dono quiser o tempo de CPU por execução no painel, pode ligar `invocation_logs`; isso é uma decisão dele e pede revisar a política.
- `apps/web/wrangler.jsonc`: continua `observability.enabled: false`. Um teste confere os dois arquivos.
- Os eventos vêm de uma **lista fechada** (`apps/sync/src/log.ts`): nome do evento mais fluxo, códigos e contagens. A validação é Zod estrito; evento fora da lista vira `log_invalido`. Testes rodam o fluxo inteiro (troca de token, erros forçados) e conferem que nem a chave, nem o token, nem cabeçalhos, nem URLs, nem dado de saúde aparecem no console.
- Plano gratuito: retenção de 3 dias e 200 mil eventos por dia. A política de privacidade diz isso (seção 4) e foi atualizada no mesmo PR. Se a conta mudar de plano (7 dias de retenção), a política volta para revisão.

### D1 de produção e deploy automático (como não quebrar a `main`)

O id real do D1 só existe depois que o dono o cria. Escolha: `apps/sync/wrangler.jsonc` traz o marcador `COLOQUE-AQUI-O-ID-DO-D1`, e o site (`apps/web/wrangler.jsonc`) traz as ligações `DB` e `SYNC` **comentadas**, porque declarar ligação para um banco ou Worker que não existe derruba o deploy do site. O `deploy.yml` publica a Worker `sync` **antes** do site, só quando o marcador já foi trocado (senão avisa e pula). Dois testes conferem que os arquivos combinam: marcador no sync implica nenhuma ligação ativa no site; id de verdade no sync implica o mesmo id e a ligação `SYNC` no site.

### Passo a passo do dono (nesta ordem)

1. `pnpm install` e, em `apps/sync`, `pnpm exec wrangler login` (se ainda não estiver).
2. Criar o banco: `pnpm --filter @sou-atleta/sync exec wrangler d1 create sou-atleta`. Copiar o `database_id` que aparece.
3. Em `apps/sync/wrangler.jsonc`, trocar `COLOQUE-AQUI-O-ID-DO-D1` pelo id. Em `apps/web/wrangler.jsonc`, tirar o `//` das duas linhas comentadas (`d1_databases` e `services`) e pôr o mesmo id. (O agente pode fazer essa troca num PR pequeno, se o dono passar o id.)
4. **Aprovar e aplicar a migração** (a primeira do projeto): `pnpm --filter @sou-atleta/sync exec wrangler d1 migrations apply sou-atleta --remote`.
5. Mesclar o PR do passo 3 (o deploy publica a `sync` e depois o site). Sem chave, o site mostra "Chave da Garmin não cadastrada".
6. No Garmin Connect Web, gerar a chave da Personal API com **validade de 180 dias**. Ela aparece uma única vez.
7. Cadastrar, **só pelo prompt interativo** (nunca com `echo` ou pipe, nunca em arquivo, chat ou issue): `pnpm --filter @sou-atleta/sync exec wrangler secret put GARMIN_API_KEY` (colar a chave sem aspas) e `pnpm --filter @sou-atleta/sync exec wrangler secret put GARMIN_CHAVE_VENCE_EM` (data de criação mais 180 dias, `AAAA-MM-DD`).
8. Abrir `/app` e apertar "Atualizar agora". Acompanhar o aviso e, se precisar, os logs da Worker `sou-atleta-sync` na Cloudflare.
9. A cada 180 dias: repetir 6 e 7 (o `secret put` substitui o valor) e apertar "Atualizar agora".

Recomendação: antes do passo 7, atualizar a política de privacidade para dizer que o conector está ativo (hoje ela marca tudo que depende da Garmin como "Ainda não ativo") e ter a issue #22 (Sair, Desconectar a Garmin e Apagar minha conta) pronta.
