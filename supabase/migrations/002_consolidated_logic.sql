-- Migration: 002_consolidated_logic.sql
-- Description: Consolidated Functions, Triggers, and Views

-- ============================================
-- HELPER FUNCTIONS (Updated Updated_At)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_bets_updated_at BEFORE UPDATE ON public.bets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- PROFILE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- GROUP CREATION TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_group_created
    AFTER INSERT ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

-- ============================================
-- SCORING LOGIC (from 005)
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
    IF bet_home IS NULL OR bet_away IS NULL OR match_home IS NULL OR match_away IS NULL THEN
        RETURN 0;
    END IF;

    pts_exact := COALESCE((rules->>'exact')::INTEGER, 10);
    pts_winner_diff := COALESCE((rules->>'winner_diff')::INTEGER, 7);
    pts_winner := COALESCE((rules->>'winner')::INTEGER, 5);
    pts_one_score := COALESCE((rules->>'one_score')::INTEGER, 2);

    IF bet_home > bet_away THEN bet_winner := 'HOME';
    ELSIF bet_away > bet_home THEN bet_winner := 'AWAY';
    ELSE bet_winner := 'DRAW';
    END IF;

    IF match_home > match_away THEN match_winner := 'HOME';
    ELSIF match_away > match_home THEN match_winner := 'AWAY';
    ELSE match_winner := 'DRAW';
    END IF;

    bet_diff := bet_home - bet_away;
    match_diff := match_home - match_away;

    IF bet_home = match_home AND bet_away = match_away THEN RETURN pts_exact; END IF;
    IF bet_winner = match_winner AND bet_diff = match_diff THEN RETURN pts_winner_diff; END IF;
    IF bet_winner = match_winner THEN RETURN pts_winner; END IF;
    IF bet_home = match_home OR bet_away = match_away THEN RETURN pts_one_score; END IF;

    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Legacy wrapper
CREATE OR REPLACE FUNCTION public.calculate_points(bet_home INTEGER, bet_away INTEGER, match_home INTEGER, match_away INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN public.calculate_points_with_rules(bet_home, bet_away, match_home, match_away, '{"exact": 10, "winner_diff": 7, "winner": 5, "one_score": 2}'::jsonb);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger: Update Points on Match Change
CREATE OR REPLACE FUNCTION public.update_points_on_match_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status IN ('finished', 'FT', 'AET', 'PEN')) AND 
       (NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL) THEN
        
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

CREATE OR REPLACE TRIGGER on_match_score_update
    AFTER UPDATE OF home_score, away_score, status ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.update_points_on_match_change();

-- Trigger: Calculate Points on Bet Save
CREATE OR REPLACE FUNCTION public.calculate_bet_points_on_save()
RETURNS TRIGGER AS $$
DECLARE
    m_home INTEGER; m_away INTEGER; m_status TEXT; group_rules JSONB;
BEGIN
    SELECT home_score, away_score, status INTO m_home, m_away, m_status
    FROM public.matches WHERE id = NEW.match_id;

    SELECT COALESCE(scoring_rules, '{"exact": 10, "winner_diff": 7, "winner": 5, "one_score": 2}'::jsonb)
    INTO group_rules FROM public.groups WHERE id = NEW.group_id;

    IF m_status IN ('finished', 'FT', 'AET', 'PEN') AND m_home IS NOT NULL AND m_away IS NOT NULL THEN
        NEW.points := public.calculate_points_with_rules(NEW.home_score_bet, NEW.away_score_bet, m_home, m_away, group_rules);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_bet_save_calc_points
    BEFORE INSERT OR UPDATE ON public.bets
    FOR EACH ROW EXECUTE FUNCTION public.calculate_bet_points_on_save();

-- ============================================
-- NOTIFICATION TRIGGERS
-- ============================================

-- Notification on New Member / Invitation Acceptance (012 fixed version)
CREATE OR REPLACE FUNCTION public.handle_new_group_member_notification()
RETURNS TRIGGER AS $$
DECLARE
    _group_admin_id UUID; _group_name TEXT; _joiner_name TEXT; _joiner_email TEXT; _invitation_exists BOOLEAN := FALSE;
BEGIN
    SELECT name INTO _group_name FROM public.groups WHERE id = NEW.group_id;
    SELECT COALESCE(display_name, email), email INTO _joiner_name, _joiner_email FROM public.profiles WHERE id = NEW.user_id;
    SELECT created_by INTO _group_admin_id FROM public.groups WHERE id = NEW.group_id;

    SELECT EXISTS(SELECT 1 FROM public.group_invitations gi WHERE gi.group_id = NEW.group_id AND gi.invited_email = _joiner_email AND gi.status = 'pending' AND gi.expires_at > NOW()) INTO _invitation_exists;

    IF _invitation_exists THEN
        UPDATE public.group_invitations SET status = 'accepted', accepted_at = NOW() WHERE group_id = NEW.group_id AND invited_email = _joiner_email AND status = 'pending';
    END IF;

    IF NEW.user_id <> _group_admin_id THEN
        IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _group_admin_id AND COALESCE((notification_settings->>'new_member')::boolean, true) = true) THEN
            INSERT INTO public.notifications (user_id, title, message, type, data)
            VALUES (
                _group_admin_id,
                CASE WHEN _invitation_exists THEN 'Convite aceito!' ELSE 'Novo membro no grupo!' END,
                CASE WHEN _invitation_exists THEN _joiner_name || ' aceitou o convite e entrou no grupo ' || _group_name ELSE _joiner_name || ' acabou de entrar no grupo ' || _group_name END,
                CASE WHEN _invitation_exists THEN 'success' ELSE 'info' END,
                jsonb_build_object('group_id', NEW.group_id, 'user_id', NEW.user_id, 'via_invitation', _invitation_exists)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_group_member_joined
    AFTER INSERT ON public.group_members
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_group_member_notification();

-- Join Request System (015 + 018)
CREATE OR REPLACE FUNCTION public.notify_admin_on_join_request()
RETURNS TRIGGER AS $$
DECLARE
    admin_id UUID; group_name_var TEXT; requester_name TEXT;
BEGIN
    IF NEW.status != 'pending' THEN RETURN NEW; END IF;
    IF (TG_OP = 'UPDATE' AND OLD.status = 'pending') THEN RETURN NEW; END IF;

    SELECT COALESCE(name, 'Grupo sem nome') INTO group_name_var FROM public.groups WHERE id = NEW.group_id;
    SELECT COALESCE(display_name, nickname, SUBSTRING(email FROM '(.*)@'), 'Usuário') INTO requester_name FROM public.profiles WHERE id = NEW.user_id;
    
    FOR admin_id IN SELECT user_id FROM public.group_members WHERE group_id = NEW.group_id AND role = 'admin' LOOP
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
            admin_id,
            'notifications.system.join_request.title',
            'notifications.system.join_request.message',
            'join_request',
            jsonb_build_object('pending_member_id', NEW.id, 'group_id', NEW.group_id, 'group', group_name_var, 'requester_id', NEW.user_id, 'name', requester_name, 'link', '/groups/' || NEW.group_id::TEXT)
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_pending_member_created
    AFTER INSERT OR UPDATE ON public.pending_members
    FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_join_request();

-- Invitation Expiration (006)
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.group_invitations SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER cleanup_expired_invitations
    AFTER INSERT ON public.group_invitations
    FOR EACH STATEMENT EXECUTE FUNCTION public.expire_old_invitations();

-- ============================================
-- RPCS & UTILS (016, 010)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_group_by_invite_code(p_code TEXT)
RETURNS TABLE (id UUID, name TEXT, join_requires_approval BOOLEAN, is_public BOOLEAN) AS $$
BEGIN
    RETURN QUERY SELECT g.id, g.name, g.join_requires_approval, g.is_public FROM public.groups g WHERE g.invite_code = p_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_group_by_invite_token(p_token TEXT)
RETURNS TABLE (group_id UUID, invited_email TEXT, status TEXT, expires_at TIMESTAMPTZ, group_name TEXT, join_requires_approval BOOLEAN) AS $$
BEGIN
    RETURN QUERY SELECT gi.group_id, gi.invited_email, gi.status, gi.expires_at, g.name, g.join_requires_approval 
    FROM public.group_invitations gi JOIN public.groups g ON gi.group_id = g.id WHERE gi.invite_token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MARKETING FUNCTIONS (010)
CREATE OR REPLACE FUNCTION public.get_smart_campaign_preview(
    p_days_ahead INTEGER DEFAULT NULL,
    p_only_admins BOOLEAN DEFAULT FALSE,
    p_event_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.group_members gm
    JOIN public.groups g ON gm.group_id = g.id
    WHERE (NOT p_only_admins OR gm.role = 'admin')
    AND (p_event_id IS NULL OR g.event_id = p_event_id)
    AND (
        p_days_ahead IS NULL 
        OR EXISTS (
            SELECT 1 FROM public.matches m
            WHERE m.event_id = g.event_id
            AND m.match_date > NOW() 
            AND m.match_date < NOW() + (p_days_ahead || ' days')::interval
            AND m.status = 'scheduled'
            AND NOT EXISTS (
                SELECT 1 FROM public.bets b
                WHERE b.user_id = gm.user_id
                AND b.group_id = gm.group_id
                AND b.match_id = m.id
            )
        )
    );
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_smart_campaign_targets(
    p_days_ahead INTEGER DEFAULT NULL,
    p_only_admins BOOLEAN DEFAULT FALSE,
    p_event_id UUID DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    group_id UUID,
    group_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT gm.user_id, gm.group_id, g.name
    FROM public.group_members gm
    JOIN public.groups g ON gm.group_id = g.id
    WHERE (NOT p_only_admins OR gm.role = 'admin')
    AND (p_event_id IS NULL OR g.event_id = p_event_id)
    AND (
        p_days_ahead IS NULL 
        OR EXISTS (
            SELECT 1 FROM public.matches m
            WHERE m.event_id = g.event_id
            AND m.match_date > NOW() 
            AND m.match_date < NOW() + (p_days_ahead || ' days')::interval
            AND m.status = 'scheduled'
            AND NOT EXISTS (
                SELECT 1 FROM public.bets b
                WHERE b.user_id = gm.user_id
                AND b.group_id = gm.group_id
                AND b.match_id = m.id
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VIEWS
-- ============================================
CREATE OR REPLACE VIEW public.rankings AS
SELECT 
    b.user_id, p.display_name, p.avatar_url,
    COUNT(b.id) as total_bets,
    SUM(COALESCE(b.points, 0)) as total_points,
    COUNT(CASE WHEN b.points = 10 THEN 1 END) as exact_scores
FROM public.bets b
JOIN public.profiles p ON b.user_id = p.id
JOIN public.matches m ON b.match_id = m.id
WHERE m.status IN ('finished', 'FT', 'AET', 'PEN')
GROUP BY b.user_id, p.display_name, p.avatar_url;

CREATE OR REPLACE VIEW public.group_rankings AS
SELECT 
    gm.group_id, gm.user_id, p.display_name, p.avatar_url,
    SUM(COALESCE(b.points, 0)) as total_points,
    COUNT(CASE WHEN b.points = 10 THEN 1 END) as exact_scores
FROM public.group_members gm
JOIN public.profiles p ON gm.user_id = p.id
LEFT JOIN public.bets b ON b.user_id = gm.user_id
LEFT JOIN public.matches m ON b.match_id = m.id
WHERE m.event_id IN (SELECT event_id FROM public.groups WHERE id = gm.group_id)
  AND m.status IN ('finished', 'FT', 'AET', 'PEN')
GROUP BY gm.group_id, gm.user_id, p.display_name, p.avatar_url;
