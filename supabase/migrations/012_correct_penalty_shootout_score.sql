-- Migration: 012_correct_penalty_shootout_score.sql
-- Description: Trigger to automatically correct match scores for penalty shootouts to be the score at the end of extra time.

CREATE OR REPLACE FUNCTION public.correct_penalty_shootout_score()
RETURNS TRIGGER AS $$
DECLARE
    v_duration TEXT;
    v_reg_home INT;
    v_reg_away INT;
    v_ext_home INT;
    v_ext_away INT;
BEGIN
    -- Check if score_detailed is provided and has duration = 'PENALTY_SHOOTOUT'
    IF NEW.score_detailed IS NOT NULL AND NEW.score_detailed->>'duration' = 'PENALTY_SHOOTOUT' THEN
        v_reg_home := COALESCE((NEW.score_detailed->'regularTime'->>'home')::INT, 0);
        v_reg_away := COALESCE((NEW.score_detailed->'regularTime'->>'away')::INT, 0);
        v_ext_home := COALESCE((NEW.score_detailed->'extraTime'->>'home')::INT, 0);
        v_ext_away := COALESCE((NEW.score_detailed->'extraTime'->>'away')::INT, 0);
        
        NEW.home_score := v_reg_home + v_ext_home;
        NEW.away_score := v_reg_away + v_ext_away;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_correct_penalty_shootout_score ON public.matches;

-- Create BEFORE trigger to correct the scores
CREATE TRIGGER trg_correct_penalty_shootout_score
BEFORE INSERT OR UPDATE OF home_score, away_score, score_detailed ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.correct_penalty_shootout_score();

-- One-time update to correct any existing matches with PENALTY_SHOOTOUT duration
UPDATE public.matches
SET home_score = COALESCE((score_detailed->'regularTime'->>'home')::INT, 0) + COALESCE((score_detailed->'extraTime'->>'home')::INT, 0),
    away_score = COALESCE((score_detailed->'regularTime'->>'away')::INT, 0) + COALESCE((score_detailed->'extraTime'->>'away')::INT, 0)
WHERE score_detailed IS NOT NULL AND score_detailed->>'duration' = 'PENALTY_SHOOTOUT';
