-- =====================================================
-- FIX: Complete Scoring System WITH Custom Rules per Group
-- Execute este script COMPLETO no SQL Editor do Supabase
-- =====================================================

-- ============================================
-- 1. FUNÇÃO DE CÁLCULO COM REGRAS CUSTOMIZADAS
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_points_with_rules(
    bet_home INTEGER,
    bet_away INTEGER,
    match_home INTEGER,
    match_away INTEGER,
    rules JSONB
)
RETURNS INTEGER AS $$
DECLARE
    bet_diff INTEGER;
    match_diff INTEGER;
    bet_winner TEXT;
    match_winner TEXT;
    pts_exact INTEGER;
    pts_winner_diff INTEGER;
    pts_winner INTEGER;
    pts_one_score INTEGER;
BEGIN
    -- Handle NULL values
    IF bet_home IS NULL OR bet_away IS NULL OR match_home IS NULL OR match_away IS NULL THEN
        RETURN 0;
    END IF;

    -- Get scoring values from rules (with defaults)
    pts_exact := COALESCE((rules->>'exact')::INTEGER, 10);
    pts_winner_diff := COALESCE((rules->>'winner_diff')::INTEGER, 7);
    pts_winner := COALESCE((rules->>'winner')::INTEGER, 5);
    pts_one_score := COALESCE((rules->>'one_score')::INTEGER, 2);

    -- Determine winners
    IF bet_home > bet_away THEN bet_winner := 'HOME';
    ELSIF bet_away > bet_home THEN bet_winner := 'AWAY';
    ELSE bet_winner := 'DRAW';
    END IF;

    IF match_home > match_away THEN match_winner := 'HOME';
    ELSIF match_away > match_home THEN match_winner := 'AWAY';
    ELSE match_winner := 'DRAW';
    END IF;

    -- Calculate differences
    bet_diff := bet_home - bet_away;
    match_diff := match_home - match_away;

    -- Rule 1: Exact Score (Cravada)
    IF bet_home = match_home AND bet_away = match_away THEN
        RETURN pts_exact;
    END IF;

    -- Rule 2: Correct Winner + Correct Diff
    IF bet_winner = match_winner AND bet_diff = match_diff THEN
        RETURN pts_winner_diff;
    END IF;

    -- Rule 3: Correct Winner
    IF bet_winner = match_winner THEN
        RETURN pts_winner;
    END IF;

    -- Rule 4: Consolation (One exact score)
    IF bet_home = match_home OR bet_away = match_away THEN
        RETURN pts_one_score;
    END IF;

    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 2. FUNÇÃO SIMPLES (para compatibilidade)
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_points(
    bet_home INTEGER,
    bet_away INTEGER,
    match_home INTEGER,
    match_away INTEGER
)
RETURNS INTEGER AS $$
BEGIN
    RETURN public.calculate_points_with_rules(
        bet_home, bet_away, match_home, match_away,
        '{"exact": 10, "winner_diff": 7, "winner": 5, "one_score": 2}'::jsonb
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 3. TRIGGER: ATUALIZAR PONTOS AO MUDAR PLACAR
-- ============================================
CREATE OR REPLACE FUNCTION public.update_points_on_match_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run if match is finished and has scores
    IF (NEW.status IN ('finished', 'FT', 'AET', 'PEN')) AND 
       (NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL) THEN
        
        -- Update each bet using the group's scoring rules
        UPDATE public.bets b
        SET points = public.calculate_points_with_rules(
            b.home_score_bet, 
            b.away_score_bet, 
            NEW.home_score, 
            NEW.away_score,
            COALESCE(g.scoring_rules, '{"exact": 10, "winner_diff": 7, "winner": 5, "one_score": 2}'::jsonb)
        )
        FROM public.groups g
        WHERE b.group_id = g.id
        AND b.match_id = NEW.id;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_match_score_update ON public.matches;
CREATE TRIGGER on_match_score_update
    AFTER UPDATE OF home_score, away_score, status ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_points_on_match_change();

-- ============================================
-- 4. TRIGGER: CALCULAR PONTOS AO SALVAR APOSTA
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_bet_points_on_save()
RETURNS TRIGGER AS $$
DECLARE
    m_home INTEGER;
    m_away INTEGER;
    m_status TEXT;
    group_rules JSONB;
BEGIN
    -- Get match info
    SELECT home_score, away_score, status INTO m_home, m_away, m_status
    FROM public.matches
    WHERE id = NEW.match_id;

    -- Get group scoring rules
    SELECT COALESCE(scoring_rules, '{"exact": 10, "winner_diff": 7, "winner": 5, "one_score": 2}'::jsonb)
    INTO group_rules
    FROM public.groups
    WHERE id = NEW.group_id;

    IF m_status IN ('finished', 'FT', 'AET', 'PEN') AND m_home IS NOT NULL AND m_away IS NOT NULL THEN
        NEW.points := public.calculate_points_with_rules(
            NEW.home_score_bet, 
            NEW.away_score_bet, 
            m_home, 
            m_away,
            group_rules
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_bet_save_calc_points ON public.bets;
CREATE TRIGGER on_bet_save_calc_points
    BEFORE INSERT OR UPDATE ON public.bets
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_bet_points_on_save();

-- ============================================
-- 5. RECALCULAR PONTOS DE TODAS AS APOSTAS
-- ============================================
UPDATE public.bets b
SET points = public.calculate_points_with_rules(
    b.home_score_bet,
    b.away_score_bet,
    m.home_score,
    m.away_score,
    COALESCE(g.scoring_rules, '{"exact": 10, "winner_diff": 7, "winner": 5, "one_score": 2}'::jsonb)
)
FROM public.matches m, public.groups g
WHERE b.match_id = m.id
  AND b.group_id = g.id
  AND m.status IN ('finished', 'FT', 'AET', 'PEN')
  AND m.home_score IS NOT NULL
  AND m.away_score IS NOT NULL;

-- ============================================
-- 6. VERIFICAR RESULTADO
-- ============================================
SELECT 
    p.display_name,
    g.name as grupo,
    g.scoring_rules,
    b.home_score_bet as aposta_casa,
    b.away_score_bet as aposta_fora,
    m.home_score as real_casa,
    m.away_score as real_fora,
    b.points as pontos
FROM public.bets b
JOIN public.matches m ON b.match_id = m.id
JOIN public.groups g ON b.group_id = g.id
JOIN public.profiles p ON b.user_id = p.id
WHERE m.status IN ('finished', 'FT', 'AET', 'PEN')
LIMIT 10;
