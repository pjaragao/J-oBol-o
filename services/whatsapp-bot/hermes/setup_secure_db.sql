-- =====================================================================
-- SCRIPT DE SEGURANÇA E ACESSO SEGURO PARA O NEYBOT (HERMES AGENT)
-- Execute este script no SQL Editor do seu painel do Supabase.
-- =====================================================================

-- 1. Criar o Schema dedicado para o Bot
CREATE SCHEMA IF NOT EXISTS neybot;

-- 2. Criar Views de Somente Leitura expostas ao Bot

-- View de Grupos (apenas os que estão com bot ativado)
CREATE OR REPLACE VIEW neybot.groups AS
SELECT 
  id, 
  name, 
  whatsapp_group_jid, 
  event_id
FROM public.groups
WHERE whatsapp_bot_enabled = true;

-- View de Membros de Grupos
CREATE OR REPLACE VIEW neybot.group_members AS
SELECT 
  group_id, 
  user_id
FROM public.group_members;

-- View de Perfis (expondo apenas o essencial para ranking)
CREATE OR REPLACE VIEW neybot.profiles AS
SELECT 
  id, 
  display_name, 
  nickname
FROM public.profiles;

-- View de Times
CREATE OR REPLACE VIEW neybot.teams AS
SELECT 
  id, 
  name
FROM public.teams;

-- View de Jogos/Partidas
CREATE OR REPLACE VIEW neybot.matches AS
SELECT 
  id, 
  event_id, 
  home_team_id, 
  away_team_id, 
  match_date, 
  home_score, 
  away_score, 
  status, 
  round
FROM public.matches;

-- View de Links de WhatsApp verificados
CREATE OR REPLACE VIEW neybot.whatsapp_links AS
SELECT 
  user_id, 
  group_id, 
  whatsapp_jid, 
  whatsapp_name, 
  verified
FROM public.whatsapp_links
WHERE verified = true;

-- View CRÍTICA: Apostas/Palpites (Evita cópias e espionagem)
-- Esta view OMITIRÁ os placares das apostas se o jogo ainda não tiver começado.
CREATE OR REPLACE VIEW neybot.bets AS
SELECT 
  b.id,
  b.user_id,
  b.group_id,
  b.match_id,
  wl.whatsapp_jid,
  -- Retorna o palpite apenas se a partida já começou (live/finished) ou se a data do jogo passou
  CASE 
    WHEN m.status IN ('live', 'finished') OR m.match_date <= NOW() THEN b.home_score_bet 
    ELSE NULL 
  END as home_score_bet,
  CASE 
    WHEN m.status IN ('live', 'finished') OR m.match_date <= NOW() THEN b.away_score_bet 
    ELSE NULL 
  END as away_score_bet,
  b.points_earned,
  b.created_at
FROM public.bets b
JOIN public.matches m ON m.id = b.match_id
LEFT JOIN public.whatsapp_links wl ON wl.user_id = b.user_id AND wl.group_id = b.group_id AND wl.verified = true;


-- 3. Criar Usuário de Banco de Dados Restrito (Somente Leitura)
-- Substitua 'UmaSenhaMuitoSegura123!' por uma senha forte de sua preferência.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'neybot_reader') THEN
    CREATE ROLE neybot_reader WITH LOGIN PASSWORD 'UmaSenhaMuitoSegura123!';
  END IF;
END
$$;

-- 4. Conceder permissões de apenas leitura ao schema neybot
GRANT USAGE ON SCHEMA neybot TO neybot_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA neybot TO neybot_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA neybot GRANT SELECT ON TABLES TO neybot_reader;

-- 5. Revogar explicitamente qualquer acesso ao schema public para o neybot_reader
REVOKE ALL ON SCHEMA public FROM neybot_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM neybot_reader;

-- Com isso, o usuário 'neybot_reader' conseguirá ler APENAS as views criadas no schema 'neybot'.
-- Nenhuma alteração de dados (INSERT, UPDATE, DELETE) será permitida.
