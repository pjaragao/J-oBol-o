-- Migration: Scoring System and Views (Consolidated)
-- Description: Point calculation logic, triggers, and ranking views

-- ============================================
-- SCORING CALCULATION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_points(
    bet_home INTEGER,
    bet_away INTEGER,
    match_home INTEGER,
    match_away INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    points INTEGER := 0;
    bet_diff INTEGER;
    match_diff INTEGER;
    bet_winner TEXT; -- 'HOME', 'AWAY', 'DRAW'
    match_winner TEXT;
BEGIN
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

    -- Rule 1: Exact Score (Cravada) - 10 pts
    IF bet_home = match_home AND bet_away = match_away THEN
        RETURN 10;
    END IF;

    -- Rule 2: Correct Winner + Correct Diff - 7 pts
    IF bet_winner = match_winner AND bet_diff = match_diff THEN
        RETURN 7;
    END IF;

    -- Rule 3: Correct Winner - 5 pts
    IF bet_winner = match_winner THEN
        RETURN 5;
    END IF;

    -- Rule 4: Consolation (One exact score) - 2 pts
    IF bet_home = match_home OR bet_away = match_away THEN
        RETURN 2;
    END IF;

    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- TRIGGER: UPDATE POINTS ON MATCH CHANGE
-- ============================================
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

DROP TRIGGER IF EXISTS on_match_score_update ON public.matches;
CREATE TRIGGER on_match_score_update
    AFTER UPDATE OF home_score, away_score, status ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_points_on_match_change();

-- ============================================
-- TRIGGER: CALCULATE POINTS ON BET SAVE
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_bet_points_on_save()
RETURNS TRIGGER AS $$
DECLARE
    m_home INTEGER;
    m_away INTEGER;
    m_status TEXT;
BEGIN
    SELECT home_score, away_score, status INTO m_home, m_away, m_status
    FROM public.matches
    WHERE id = NEW.match_id;

    IF m_status IN ('finished', 'FT', 'AET', 'PEN') AND m_home IS NOT NULL AND m_away IS NOT NULL THEN
        NEW.points := public.calculate_points(NEW.home_score_bet, NEW.away_score_bet, m_home, m_away);
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
-- TRIGGER: NOTIFY GROUP ADMIN ON NEW MEMBER
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_group_member_notification()
RETURNS TRIGGER AS $$
DECLARE
    group_admin_id UUID;
    group_name TEXT;
    joiner_name TEXT;
BEGIN
    -- Get group name
    SELECT name INTO group_name FROM public.groups WHERE id = NEW.group_id;
    
    -- Get joiner name
    SELECT COALESCE(display_name, email) INTO joiner_name FROM public.profiles WHERE id = NEW.user_id;
    
    -- Get group admin (the creator)
    SELECT created_by INTO group_admin_id FROM public.groups WHERE id = NEW.group_id;

    -- Only notify if the joiner is NOT the admin himself AND admin has enabled this notification
    IF NEW.user_id <> group_admin_id THEN
        IF EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = group_admin_id 
              AND COALESCE((notification_settings->>'new_member')::boolean, true) = true
        ) THEN
            INSERT INTO public.notifications (user_id, title, message, type, data)
            VALUES (
                group_admin_id,
                'notifications.system.new_member.title',
                'notifications.system.new_member.message',
                'info',
                jsonb_build_object(
                    'group_id', NEW.group_id, 
                    'user_id', NEW.user_id,
                    'name', joiner_name,
                    'group', group_name
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_group_member_joined ON public.group_members;
CREATE TRIGGER on_group_member_joined
    AFTER INSERT ON public.group_members
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_group_member_notification();

-- ============================================
-- TRIGGER: NOTIFY USER ON POINTS + RANK
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_bet_points_notification()
RETURNS TRIGGER AS $$
DECLARE
    u_rank INTEGER;
    g_name TEXT;
    match_desc TEXT;
BEGIN
    -- Only notify if points were actually updated and are > 0
    IF (OLD.points IS DISTINCT FROM NEW.points) AND NEW.points > 0 THEN
        -- Get group name
        SELECT name INTO g_name FROM public.groups WHERE id = NEW.group_id;
        
        -- Get match description
        SELECT m.h_name || ' ' || m.home_score || ' x ' || m.away_score || ' ' || m.a_name
        INTO match_desc
        FROM (
            SELECT h.name as h_name, a.name as a_name, mat.home_score, mat.away_score
            FROM public.matches mat
            JOIN public.teams h ON mat.home_team_id = h.id
            JOIN public.teams a ON mat.away_team_id = a.id
            WHERE mat.id = NEW.match_id
        ) m;

        -- Calculate rank in group
        WITH ranks AS (
            SELECT user_id, 
                   RANK() OVER (ORDER BY SUM(COALESCE(points, 0)) DESC, COUNT(CASE WHEN points = 10 THEN 1 END) DESC) as pos
            FROM public.bets
            WHERE group_id = NEW.group_id
            GROUP BY user_id
        )
        SELECT pos INTO u_rank FROM ranks WHERE user_id = NEW.user_id;

        -- Check user preference before inserting
        IF EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = NEW.user_id 
              AND COALESCE((notification_settings->>'points_rank')::boolean, true) = true
        ) THEN
            INSERT INTO public.notifications (user_id, title, message, type, data)
            VALUES (
                NEW.user_id,
                'notifications.system.points_updated.title',
                'notifications.system.points_updated.message',
                'points',
                jsonb_build_object(
                    'group_id', NEW.group_id, 
                    'match_id', NEW.match_id, 
                    'points', NEW.points, 
                    'rank', u_rank,
                    'match', match_desc,
                    'group', g_name
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bet_points_update ON public.bets;
CREATE TRIGGER on_bet_points_update
    AFTER UPDATE OF points ON public.bets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_bet_points_notification();

-- ============================================
-- TRIGGER: NOTIFY MEMBERS ON GROUP RULE CHANGE
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_group_rules_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.scoring_rules IS DISTINCT FROM NEW.scoring_rules) THEN
        INSERT INTO public.notifications (user_id, title, message, type, data)
        SELECT 
            gm.user_id,
            'notifications.system.rules_changed.title',
            'notifications.system.rules_changed.message',
            'warning',
            jsonb_build_object(
                'group_id', NEW.id,
                'group', NEW.name
            )
        FROM public.group_members gm
        JOIN public.profiles p ON gm.user_id = p.id
        WHERE gm.group_id = NEW.id
          AND COALESCE((p.notification_settings->>'rule_change')::boolean, true) = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_group_rules_update ON public.groups;
CREATE TRIGGER on_group_rules_update
    AFTER UPDATE OF scoring_rules ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_group_rules_notification();

-- ============================================
-- VIEWS: RANKINGS
-- ============================================

-- Global Rankings (Points per User)
CREATE OR REPLACE VIEW public.rankings AS
SELECT 
    b.user_id,
    p.display_name,
    p.avatar_url,
    COUNT(b.id) as total_bets,
    SUM(COALESCE(b.points, 0)) as total_points,
    COUNT(CASE WHEN b.points = 10 THEN 1 END) as exact_scores
FROM public.bets b
JOIN public.profiles p ON b.user_id = p.id
JOIN public.matches m ON b.match_id = m.id
WHERE m.status IN ('finished', 'FT', 'AET', 'PEN')
GROUP BY b.user_id, p.display_name, p.avatar_url;

-- Group Rankings
CREATE OR REPLACE VIEW public.group_rankings AS
SELECT 
    gm.group_id,
    gm.user_id,
    p.display_name,
    p.avatar_url,
    SUM(COALESCE(b.points, 0)) as total_points,
    COUNT(CASE WHEN b.points = 10 THEN 1 END) as exact_scores
FROM public.group_members gm
JOIN public.profiles p ON gm.user_id = p.id
LEFT JOIN public.bets b ON b.user_id = gm.user_id
LEFT JOIN public.matches m ON b.match_id = m.id
WHERE m.event_id IN (SELECT event_id FROM public.groups WHERE id = gm.group_id)
  AND m.status IN ('finished', 'FT', 'AET', 'PEN')
GROUP BY gm.group_id, gm.user_id, p.display_name, p.avatar_url;
