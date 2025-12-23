-- Seed Data for JãoBolão
-- Run after migrations to populate initial data

-- ============================================
-- SAMPLE TEAMS (Popular Brazilian Teams)
-- ============================================
-- First, add UNIQUE constraint on team name if not exists
ALTER TABLE public.teams ADD CONSTRAINT teams_name_unique UNIQUE (name);

INSERT INTO public.teams (name, short_name, country, logo_url) VALUES
('Flamengo', 'FLA', 'Brazil', 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Flamengo_bridge_logo.svg'),
('Palmeiras', 'PAL', 'Brazil', 'https://upload.wikimedia.org/wikipedia/commons/1/10/Palmeiras_logo.svg'),
('Corinthians', 'COR', 'Brazil', 'https://upload.wikimedia.org/wikipedia/pt/b/b4/Corinthians_simbolo.png'),
('São Paulo', 'SAO', 'Brazil', 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Brasao_do_Sao_Paulo_Futebol_Clube.svg'),
('Fluminense', 'FLU', 'Brazil', 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Fluminense_FC.svg'),
('Botafogo', 'BOT', 'Brazil', 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Botafogo_de_Futebol_e_Regatas_logo.svg'),
('Atlético Mineiro', 'CAM', 'Brazil', 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Atletico_mineiro_galo.png'),
('Cruzeiro', 'CRU', 'Brazil', 'https://upload.wikimedia.org/wikipedia/commons/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg'),
('Internacional', 'INT', 'Brazil', 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Escudo_do_Sport_Club_Internacional.svg'),
('Grêmio', 'GRE', 'Brazil', 'https://upload.wikimedia.org/wikipedia/commons/8/84/Gremio.svg'),
('Santos', 'SAN', 'Brazil', 'https://upload.wikimedia.org/wikipedia/commons/1/15/Santos_Logo.png'),
('Vasco da Gama', 'VAS', 'Brazil', 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Vasco_da_Gama.svg')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SAMPLE EVENT (Brasileirão 2025)
-- ============================================
-- Add UNIQUE constraint on event name if not exists
ALTER TABLE public.events ADD CONSTRAINT events_name_unique UNIQUE (name);

INSERT INTO public.events (name, description, start_date, end_date, is_active) VALUES
('Brasileirão Série A 2025', 'Campeonato Brasileiro da Série A - Temporada 2025', '2025-04-01', '2025-12-08', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- INITIAL ADMIN USER (Update with real user ID after first signup)
-- ============================================
-- Note: Run this after a user signs up and you want to make them admin:
-- UPDATE public.profiles SET is_admin = true WHERE email = 'admin@example.com';

-- ============================================
-- SAMPLE SCORING RULES TEMPLATES
-- ============================================
-- These are just examples, each group can customize their rules

-- Default (stored in groups.scoring_rules):
-- {"exact": 10, "winner": 5, "goals": 3}

-- Conservative:
-- {"exact": 5, "winner": 3, "goals": 2}

-- Aggressive (rewards exact predictions more):
-- {"exact": 20, "winner": 5, "goals": 8}

-- Simple (only exact or winner):
-- {"exact": 10, "winner": 3, "goals": 3}
