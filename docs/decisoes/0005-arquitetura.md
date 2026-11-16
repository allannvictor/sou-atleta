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
| Sincronização               | Worker chamada pelo site (ao abrir `/app` e no botão), sem Cron Trigger     |
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

Especificação aprovada pelo dono em 15/11/2026, com as decisões A e B do último comentário da issue, e três decisões do dono de 16/11/2026 (sem Cron, importação inicial de 90 dias, atividades de todas as modalidades: ver a 0002). Fatos e inferências sobre a Garmin: `docs/pesquisa/garmin-limites-api-2026-11.md`.

### TRAVA: não cadastrar a chave antes da política e da #22

> **NÃO cadastre a chave (o passo de `wrangler secret put GARMIN_API_KEY`) antes de a política de privacidade revista e a issue #22 (pelo menos "Apagar minha conta" e "Desconectar a Garmin") estarem mescladas.**

Motivo: a 0007 diz que, antes de qualquer dado real entrar, a política é atualizada com nova data, e a #22 precisa existir antes de dado real. Enquanto o dono não cadastrar a chave, o conector fica inerte: o D1 não tem dado e a sync mostra "chave não cadastrada". Criar o banco, aplicar a migração e publicar a sync **não** trazem dado nenhum e podem ser feitos antes; só o passo da chave é travado. A política completa para o conector ativo e a #22 ficam em PRs separados.

### Pacotes e camadas

- `packages/garmin`: conector (troca a chave por token de 24 h, pede dados, valida tudo com Zod). **Só `apps/sync` o importa.** O tipo `GarminKey` guarda o valor num campo privado e devolve `[REDACTED]` em `toString`, `toJSON`, conversão para texto e inspeção do Node; o token (`GarminToken`) idem e vive só na memória do processo. A proteção do `inspect` vale no Node (onde rodam os testes); em produção a garantia vem do campo privado e de `apps/sync/src/log.ts` ser o único que escreve no console, só com eventos de uma lista fechada.
- `packages/db`: tabelas (Drizzle), a primeira migração (`migrations/0000_inicial.sql`) e a leitura do estado. Não importa nenhum outro pacote do projeto.
- `apps/sync`: Worker com `POST /ao-abrir` e `POST /atualizar`. **Não tem Cron Trigger.**
- O lint (`eslint.camadas.js`) é uma **lista de permitidos**: só `packages/garmin` e `apps/sync` podem importar o conector ou citar `GARMIN_API_KEY` e `GARMIN_CHAVE_VENCE_EM`, e isso vale para qualquer pacote ou app futuro (`packages/garmin/src/camadas.test.ts` prova com caminhos fictícios). Também: o site usa só a entrada principal do `db` em produção; a Garmin falsa e o banco em memória (`/teste`) só entram em arquivos de teste; só `apps/sync/src/log.ts` pode usar `console`. No ESLint, um bloco posterior substitui as opções de `no-restricted-imports` do anterior; por isso cada área repete o padrão do conector.

### Sem Cron: a sincronização roda ao abrir `/app` e no botão (decisão do dono, 16/11/2026)

- **Ao abrir `/app`:** o loader do site lê o estado e, se faz mais de 10 minutos da última tentativa e a Garmin não pediu para esperar, pede à sync (`POST /ao-abrir`, ligação interna) **em segundo plano** (`ctx.waitUntil`); a página sai sem esperar. A sync responde na hora e trabalha por conta própria. Intervalo mínimo entre aberturas: 10 minutos (`INTERVALO_MINIMO_AO_ABRIR_SEGUNDOS`), conferido no site e, de novo, na sync.
- **Botão "Atualizar agora":** `POST /atualizar`. Ignora o intervalo de 10 minutos (mantém 60 s entre cliques), mas respeita a pausa por 429. Espera a execução terminar (até uns 12 s) e responde o que de fato aconteceu: atualizada, chave recusada, token recusado, pausada, Garmin fora do ar... A tela nunca diz "iniciada" quando a Garmin ainda recusa a chave.
- Por não haver rotina, **o app só atualiza quando alguém o abre**: se o dono ficar dias sem abrir, os dados param nesse intervalo e o próximo "abrir" busca desde a última sincronização (com 3 dias de sobreposição para atividades editadas).

### Importação inicial: só os últimos 90 dias

Na primeira execução, os quatro fluxos (atividades, resumo diário, sono, HRV) começam em "hoje menos 90 dias". Cada abertura ou clique traz o próximo pedaço (até 2 janelas por execução; rodízio justo, o fluxo verificado há mais tempo primeiro, e atividades primeiro no botão). Quando os 90 dias terminam, cada execução busca desde o último dia sincronizado, relendo 3 dias. O quadro mostra "Trazendo seus últimos 3 meses: até 12/10". **O conector não pede a primeira atividade da conta nem lê o histórico antigo.** Consequência (0002): a comparação "mesma época do ano anterior" só existe após um ano de uso.

### Dois segredos, só por `wrangler secret put` (prompt interativo)

`GARMIN_API_KEY` (a chave) e `GARMIN_CHAVE_VENCE_EM` (a data de vencimento, `AAAA-MM-DD`; a Garmin não informa a data pela API, então o dono a informa para o aviso de 14 dias existir). Sem eles: estado "chave ausente" ou "sem data", com aviso claro; nunca erro silencioso. Chave com aspas ou espaço é recusada como "mal colada" antes de falar com a Garmin.

### Sem endereço público e sem a chave no site

A Worker `sou-atleta-sync` tem `workers_dev` e `preview_urls` desligados e nenhuma rota. Só a Worker do site chega nela, por **ligação interna** (service binding `SYNC`), depois de o Access e a validação do JWT liberarem `/app`. **Nunca adicione rota ou domínio à `sou-atleta-sync`**: a sync não autentica quem chama (a defesa é não ter endereço), e uma rota criada pelo painel não aparece no arquivo nem nos testes. O botão é um formulário que só aceita pedidos com `Origin` igual ao endereço do site. O site recebe só o banco (o binding do D1 é de leitura e escrita; o site só lê, por convenção e lint) e a ligação `SYNC`, nunca o `env` inteiro e nunca a chave.

### O que fica no banco (migração 0000)

`atividade`, `dia_hrv`, `dia_sono`, `dia_resumo`, `zona_fc`, `perfil_treino`, `progresso_importacao`, `sincronizacao_estado`. Cada registro tem `fonte = 'garmin'` (CHECK no banco). Atividades de **todas as modalidades** (0002). Não existe coluna para GPS, local, nome, e-mail, foto, chave ou token (teste confere os nomes). `fc_origem` é `pulso`, `cinta` ou `desconhecido`. O estado guarda só códigos curtos de erro, nunca texto de erro. Valores "sem dados" da Garmin (-1, 0) não viram medida.

### Como a sincronização cabe no plano gratuito

Limites e números em `docs/pesquisa/garmin-limites-api-2026-11.md`. Cada execução: no máximo 40 subrequests (de 50), 8 requisições à Garmin, **2 janelas de datas**, pausa de 1,5 s entre requisições, cada requisição sem seguir redirecionamento (`redirect: "manual"`; 3xx vira erro) e com resposta limitada a 1 MB. Cada janela e o avanço do progresso entram no D1 no **mesmo `batch`** (uma transação): se algo interromper, a próxima execução retoma dali, sem duplicar nem pular dia. Uma trava no banco (expira em 5 min) impede duas execuções juntas; se a anterior foi cortada (por exemplo, pelo limite de CPU), o painel mostra "tentativa anterior interrompida". 429: para na hora e grava a pausa (o botão também a respeita). Chave recusada ou token recusado: abrir a página só tenta de novo daqui a 1 hora; o botão tenta na hora. **O CPU real de 10 ms não foi medido**; os números de janelas sobem só depois de ver o painel da Cloudflare.

### Token recusado não é chave expirada

Se a troca da chave por token funciona (a Garmin aceitou a chave) e as consultas recusam o token recém-emitido, o erro é do conector (o esquema de autorização das consultas, `Bearer`, não é documentado pela Garmin): código `token_recusado`, a chave segue `ok`, e o painel diz "a Garmin aceitou a sua chave, mas recusou o acesso aos dados; o app precisa de ajuste; não gere outra chave". Só a recusa da troca (qualquer 4xx, menos 429) vira "chave recusada".

### Workers Logs: só na Worker `sync` (decisão B do dono, 15/11/2026)

- `apps/sync/wrangler.jsonc`: `observability` ligado (`head_sampling_rate` 1), com **`invocation_logs: false`** (o registro automático de cada invocação inclui dados da requisição que não controlamos) e **`traces.enabled: false`** explícito (traces registrariam as subrequests, com endereços e datas, fora da lista fechada). Se o dono quiser o tempo de CPU por execução no painel, pode ligar `invocation_logs`; isso é uma decisão dele e pede revisar a política.
- `apps/web/wrangler.jsonc`: continua `observability.enabled: false`. Um teste confere os dois arquivos.
- Os eventos vêm de uma **lista fechada** (`apps/sync/src/log.ts`): nome do evento mais fluxo, códigos e contagens. A validação é Zod estrito; evento fora da lista vira `log_invalido`. Testes rodam o fluxo inteiro **pelo `index.ts`** (`POST /ao-abrir` e `POST /atualizar`), com falha de rede e falha do banco forçadas por erros cuja mensagem traz a chave e a URL, guardando toda exceção, todo corpo de resposta e a saída dos cinco métodos do `console`, e conferem que nada disso (nem as tabelas) leva a chave, o token, cabeçalhos, URLs ou dado de saúde.
- **A plataforma também registra por conta própria exceções não tratadas.** A Worker foi desenhada para não deixar nenhuma escapar (as dependências são montadas dentro do `try`; teste com banco que lança), mas isso é uma garantia de desenho, não da Cloudflare; a política diz "por desenho, não levam".
- Plano gratuito: retenção de 3 dias e 200 mil eventos por dia. A política de privacidade diz isso (seção 4) e foi atualizada no mesmo PR. Se a conta mudar de plano (7 dias de retenção), a política volta para revisão. **Os logs começam quando a Worker `sync` é publicada** (antes de existir chave), não quando a chave é cadastrada.

### D1 de produção e deploy automático (como não quebrar a `main`)

O id real do D1 só existe depois que o dono o cria. Escolha: `apps/sync/wrangler.jsonc` traz o marcador `COLOQUE-AQUI-O-ID-DO-D1`, e o site (`apps/web/wrangler.jsonc`) traz as ligações `DB` e `SYNC` **comentadas**, porque declarar ligação para um banco ou Worker que não existe derruba o deploy do site. O `deploy.yml` publica a Worker `sync` **antes** do site, só quando o marcador já foi trocado (senão avisa e pula). Dois testes conferem que os arquivos combinam. Se o primeiro deploy falhar por permissão do `CLOUDFLARE_API_TOKEN`, acrescente **só** a permissão que faltar e registre aqui; **não** dê `D1:Edit` ao token (a migração é aplicada à mão, como manda o AGENTS.md).

### Antes de liberar um amigo no `/app`

O D1 é de um dono só (`perfil_treino` tem `CHECK id = 1`). Se um e-mail de amigo entrar em `EMAILS_PERMITIDOS`, ele passa pelo Access e vê o painel do dono e, nas próximas issues, as métricas dele. **Não libere amigo antes de existir isolamento por usuário.** Hoje o painel só mostra o estado da chave e da importação, então não bloqueia este PR.

### Passo a passo do dono (nesta ordem)

1. `pnpm install` e, na pasta do projeto, `pnpm --filter @sou-atleta/sync exec wrangler login` (se ainda não estiver).
2. Criar o banco: `pnpm --filter @sou-atleta/sync exec wrangler d1 create sou-atleta`. Copiar o `database_id`.
3. Em `apps/sync/wrangler.jsonc`, trocar `COLOQUE-AQUI-O-ID-DO-D1` pelo id. Em `apps/web/wrangler.jsonc`, tirar o `//` das duas linhas comentadas (`d1_databases` e `services`) e pôr o mesmo id. (O agente pode fazer essa troca num PR pequeno, se o dono passar o id.)
4. **Aprovar e aplicar a migração** (a primeira do projeto): `pnpm --filter @sou-atleta/sync exec wrangler d1 migrations apply sou-atleta --remote`.
5. Mesclar o PR do passo 3 (o deploy publica a sync e depois o site). Sem chave, `/app` mostra "Chave não cadastrada". Os logs da sync começam aqui.
6. **TRAVA: pare aqui.** Só continue depois de a política de privacidade revista e a #22 (pelo menos "Apagar minha conta" e "Desconectar a Garmin") estarem mescladas. **Não cadastre a chave antes disso.**
7. No Garmin Connect Web, gerar a chave da Personal API com **validade de 180 dias**. Ela aparece uma única vez.
8. Cadastrar, **só pelo prompt interativo** (nunca com `echo` ou pipe, nunca em arquivo, chat ou issue): `pnpm --filter @sou-atleta/sync exec wrangler secret put GARMIN_API_KEY` (colar a chave sem aspas) e o mesmo para `GARMIN_CHAVE_VENCE_EM` (data de criação mais 180 dias, `AAAA-MM-DD`). Cuidados:
   - **Confira o destino:** a saída do `secret put` precisa dizer `sou-atleta-sync`. Rodado na pasta do site ou na raiz, o comando cadastraria a chave na Worker **pública**. Depois, rode `wrangler secret list` nas duas Workers (`sou-atleta-sync` e `sou-atleta`): só a sync pode listar `GARMIN_*`.
   - **Nunca use** `.dev.vars`, `--secrets-file` nem `wrangler secret bulk` com a chave real: todos são arquivos. O desenvolvimento local usa só a chave falsa dos testes.
   - **Limpe a área de transferência** (e o histórico dela, se o sistema guardar) depois de colar. Não guarde cópia: se perder a chave, gere outra.
9. Abrir `/app`. A primeira abertura pede a primeira busca; recarregue em um minuto e use "Atualizar agora" para trazer o próximo pedaço dos últimos 3 meses.
10. A cada 180 dias: repetir 7 e 8 (o `secret put` substitui o valor), **atualizando também `GARMIN_CHAVE_VENCE_EM`**, e apertar "Atualizar agora".
