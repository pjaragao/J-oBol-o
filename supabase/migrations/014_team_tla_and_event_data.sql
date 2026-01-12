-- Add TLA (Three Letter Abbreviation) to teams table
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS tla TEXT;

-- Add current_matchday to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS current_matchday INTEGER;

-- Add score_detailed to matches table to store full score info (halfTime, etc)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS score_detailed JSONB;

COMMENT ON COLUMN public.teams.tla IS 'Three-letter abbreviation (e.g., MUN, CHE)';
COMMENT ON COLUMN public.events.current_matchday IS 'Current active matchday of the season';
COMMENT ON COLUMN public.matches.score_detailed IS 'Detailed score information including half-time, extra-time, and penalties';
