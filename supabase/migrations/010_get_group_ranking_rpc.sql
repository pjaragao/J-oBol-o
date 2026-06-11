-- Migration: 010_get_group_ranking_rpc.sql
-- Description: Create get_group_ranking RPC to calculate full and partial group ranking in the database

CREATE OR REPLACE FUNCTION public.get_group_ranking(p_group_id UUID)
RETURNS TABLE (
    user_id UUID,
    display_name TEXT,
    avatar_url TEXT,
    total_points INTEGER,
    live_points INTEGER,
    exact_scores INTEGER,
    winner_diff_scores INTEGER,
    winner_scores INTEGER,
    consolation_scores INTEGER
) AS $$
DECLARE
    v_event_id UUID;
    v_rules JSONB;
BEGIN
    -- Obter o evento e as regras de pontuação do grupo
    SELECT event_id, COALESCE(scoring_rules, '{"exact": 10, "winner_diff": 7, "winner": 5, "one_score": 2}'::jsonb)
    INTO v_event_id, v_rules
    FROM public.groups
    WHERE id = p_group_id;

    RETURN QUERY
    WITH member_bets AS (
        SELECT 
            gm.user_id as m_user_id,
            p.display_name as m_display_name,
            p.avatar_url as m_avatar_url,
            -- Pontos de jogos já finalizados (FT, AET, PEN, finished)
            CASE 
                WHEN m.status IN ('finished', 'FT', 'AET', 'PEN') THEN COALESCE(b.points, 0)
                ELSE 0
            END as base_points,
            -- Pontos live/parciais de jogos em andamento (live, IN_PLAY, PAUSED)
            CASE 
                WHEN m.status IN ('live', 'IN_PLAY', 'PAUSED') AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL THEN
                    public.calculate_points_with_rules(b.home_score_bet, b.away_score_bet, m.home_score, m.away_score, v_rules)
                ELSE 0
            END as live_points,
            -- Contagem de tipos de pontuação para estatísticas (usado em desempates)
            CASE WHEN m.status IN ('finished', 'FT', 'AET', 'PEN') AND b.points = COALESCE((v_rules->>'exact')::integer, 10) THEN 1 ELSE 0 END as exact_cnt,
            CASE WHEN m.status IN ('finished', 'FT', 'AET', 'PEN') AND b.points = COALESCE((v_rules->>'winner_diff')::integer, 7) THEN 1 ELSE 0 END as winner_diff_cnt,
            CASE WHEN m.status IN ('finished', 'FT', 'AET', 'PEN') AND b.points = COALESCE((v_rules->>'winner')::integer, 5) THEN 1 ELSE 0 END as winner_cnt,
            CASE WHEN m.status IN ('finished', 'FT', 'AET', 'PEN') AND b.points = COALESCE((v_rules->>'one_score')::integer, 2) THEN 1 ELSE 0 END as consolation_cnt
        FROM public.group_members gm
        JOIN public.profiles p ON p.id = gm.user_id
        LEFT JOIN public.bets b ON b.user_id = gm.user_id AND b.group_id = gm.group_id
        LEFT JOIN public.matches m ON m.id = b.match_id AND m.event_id = v_event_id
        WHERE gm.group_id = p_group_id
    )
    SELECT 
        mb.m_user_id,
        mb.m_display_name,
        mb.m_avatar_url,
        (SUM(mb.base_points) + SUM(mb.live_points))::integer as total_points,
        SUM(mb.live_points)::integer as live_points,
        SUM(mb.exact_cnt)::integer as exact_scores,
        SUM(mb.winner_diff_cnt)::integer as winner_diff_scores,
        SUM(mb.winner_cnt)::integer as winner_scores,
        SUM(mb.consolation_cnt)::integer as consolation_scores
    FROM member_bets mb
    GROUP BY mb.m_user_id, mb.m_display_name, mb.m_avatar_url
    ORDER BY total_points DESC, exact_scores DESC, winner_diff_scores DESC, winner_scores DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
