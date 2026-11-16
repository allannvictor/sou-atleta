CREATE TABLE `atividade` (
	`id` integer PRIMARY KEY NOT NULL,
	`fonte` text NOT NULL,
	`data_local` text NOT NULL,
	`inicio_local` text NOT NULL,
	`inicio_gmt` text NOT NULL,
	`tipo` text NOT NULL,
	`duracao_s` real NOT NULL,
	`distancia_m` real,
	`fc_media` real,
	`fc_maxima` real,
	`fc_origem` text DEFAULT 'desconhecido' NOT NULL,
	`fc_origem_conferida` integer DEFAULT false NOT NULL,
	`tempo_zona1_s` real,
	`tempo_zona2_s` real,
	`tempo_zona3_s` real,
	`tempo_zona4_s` real,
	`tempo_zona5_s` real,
	`vo2max` real,
	`efeito_aerobico` real,
	`efeito_anaerobico` real,
	`atualizado_em` text NOT NULL,
	CONSTRAINT "atividade_fonte" CHECK("atividade"."fonte" IN ('garmin')),
	CONSTRAINT "atividade_fc_origem" CHECK("atividade"."fc_origem" IN ('pulso', 'cinta', 'desconhecido'))
);
--> statement-breakpoint
CREATE TABLE `dia_hrv` (
	`data` text PRIMARY KEY NOT NULL,
	`fonte` text NOT NULL,
	`hrv_noite_ms` real,
	`hrv_semana_ms` real,
	`hrv_pico_5min_ms` real,
	`estado` text,
	`atualizado_em` text NOT NULL,
	CONSTRAINT "dia_hrv_fonte" CHECK("dia_hrv"."fonte" IN ('garmin'))
);
--> statement-breakpoint
CREATE TABLE `dia_resumo` (
	`data` text PRIMARY KEY NOT NULL,
	`fonte` text NOT NULL,
	`fc_repouso` integer,
	`fc_repouso_origem` text DEFAULT 'desconhecido' NOT NULL,
	`estresse_medio` integer,
	`estresse_maximo` integer,
	`body_battery_min` integer,
	`body_battery_max` integer,
	`body_battery_carregada` integer,
	`body_battery_drenada` integer,
	`body_battery_fim_do_dia` integer,
	`atualizado_em` text NOT NULL,
	CONSTRAINT "dia_resumo_fonte" CHECK("dia_resumo"."fonte" IN ('garmin')),
	CONSTRAINT "dia_resumo_fc_origem" CHECK("dia_resumo"."fc_repouso_origem" IN ('pulso', 'cinta', 'desconhecido'))
);
--> statement-breakpoint
CREATE TABLE `dia_sono` (
	`data` text PRIMARY KEY NOT NULL,
	`fonte` text NOT NULL,
	`sono_s` integer,
	`profundo_s` integer,
	`leve_s` integer,
	`rem_s` integer,
	`acordado_s` integer,
	`atualizado_em` text NOT NULL,
	CONSTRAINT "dia_sono_fonte" CHECK("dia_sono"."fonte" IN ('garmin'))
);
--> statement-breakpoint
CREATE TABLE `perfil_treino` (
	`id` integer PRIMARY KEY NOT NULL,
	`fonte` text NOT NULL,
	`sistema_de_medidas` text,
	`fuso_horario` text,
	`dias_disponiveis` text,
	`dias_longos` text,
	`atualizado_em` text NOT NULL,
	CONSTRAINT "perfil_treino_unico" CHECK("perfil_treino"."id" = 1),
	CONSTRAINT "perfil_treino_fonte" CHECK("perfil_treino"."fonte" IN ('garmin'))
);
--> statement-breakpoint
CREATE TABLE `progresso_importacao` (
	`fluxo` text PRIMARY KEY NOT NULL,
	`inicio` text NOT NULL,
	`importado_ate` text,
	`historico_completo` integer DEFAULT false NOT NULL,
	`verificado_em` text,
	`atualizado_em` text NOT NULL,
	CONSTRAINT "progresso_fluxo" CHECK("progresso_importacao"."fluxo" IN ('atividades', 'resumo_diario', 'sono', 'hrv'))
);
--> statement-breakpoint
CREATE TABLE `sincronizacao_estado` (
	`id` integer PRIMARY KEY NOT NULL,
	`status_da_chave` text DEFAULT 'nao_verificada' NOT NULL,
	`chave_vence_em` text,
	`erro_codigo` text,
	`ultima_execucao_em` text,
	`ultimo_sucesso_em` text,
	`pausa_ate` text,
	`falhas_de_limite_seguidas` integer DEFAULT 0 NOT NULL,
	`trava_ate` text,
	`atualizado_em` text NOT NULL,
	CONSTRAINT "sincronizacao_estado_unico" CHECK("sincronizacao_estado"."id" = 1),
	CONSTRAINT "sincronizacao_estado_status" CHECK("sincronizacao_estado"."status_da_chave" IN ('nao_verificada', 'ausente', 'mal_formada', 'ok', 'invalida'))
);
--> statement-breakpoint
CREATE TABLE `zona_fc` (
	`esporte` text PRIMARY KEY NOT NULL,
	`fonte` text NOT NULL,
	`metodo` text,
	`fc_maxima` integer,
	`fc_repouso` integer,
	`fc_limiar` integer,
	`zona1_piso` integer NOT NULL,
	`zona2_piso` integer NOT NULL,
	`zona3_piso` integer NOT NULL,
	`zona4_piso` integer NOT NULL,
	`zona5_piso` integer NOT NULL,
	`atualizado_em` text NOT NULL,
	CONSTRAINT "zona_fc_fonte" CHECK("zona_fc"."fonte" IN ('garmin'))
);
