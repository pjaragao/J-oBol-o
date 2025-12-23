-- =====================================================
-- FIX: Adicionar colunas home_score e away_score
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- 1. Adicionar as colunas se não existirem
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS home_score INTEGER;

ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS away_score INTEGER;

-- 2. Recriar o trigger que depende dessas colunas
DROP TRIGGER IF EXISTS on_match_score_update ON public.matches;

CREATE OR REPLACE FUNCTION public.update_points_on_match_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run if score changed or status became 'finished'
    IF (NEW.status IN ('finished', 'FT', 'AET', 'PEN')) AND 
       (NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL) THEN
        
        UPDATE public.bets
        SET points = public.calculate_points(
            home_score_bet, 
            away_score_bet, 
            NEW.home_score, 
            NEW.away_score
        )
        WHERE match_id = NEW.id;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_match_score_update
    AFTER UPDATE OF home_score, away_score, status ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_points_on_match_change();

-- 3. Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'matches' 
AND column_name IN ('home_score', 'away_score');
