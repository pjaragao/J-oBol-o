-- Functions for Marketing Campaigns

-- 1. Get count of expected notifications for smart campaign
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
            -- Matches in the group's event that happen in the next X days
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

-- 2. Get list of targets for smart campaign
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
