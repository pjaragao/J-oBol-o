-- Fix for "column reference 'invited_email' is ambiguous" error
-- This error usually happens when a PL/pgSQL variable has the same name as a column and is used in a query
-- We are renaming variables and using explicit aliases to avoid confusion

CREATE OR REPLACE FUNCTION public.handle_new_group_member_notification()
RETURNS TRIGGER AS $$
DECLARE
    _group_admin_id UUID;
    _group_name TEXT;
    _joiner_name TEXT;
    _joiner_email TEXT;
    _invitation_exists BOOLEAN := FALSE;
BEGIN
    -- Get group name
    SELECT name INTO _group_name FROM public.groups WHERE id = NEW.group_id;
    
    -- Get joiner name and email
    SELECT COALESCE(display_name, email), email INTO _joiner_name, _joiner_email
    FROM public.profiles WHERE id = NEW.user_id;
    
    -- Get group admin (the creator)
    SELECT created_by INTO _group_admin_id FROM public.groups WHERE id = NEW.group_id;

    -- Check if there's a pending invitation for this email and group
    SELECT EXISTS(
        SELECT 1 FROM public.group_invitations gi
        WHERE gi.group_id = NEW.group_id
          AND gi.invited_email = _joiner_email
          AND gi.status = 'pending'
          AND gi.expires_at > NOW()
    ) INTO _invitation_exists;

    -- If invitation exists, accept it
    IF _invitation_exists THEN
        UPDATE public.group_invitations
        SET status = 'accepted', accepted_at = NOW()
        WHERE group_id = NEW.group_id
          AND invited_email = _joiner_email
          AND status = 'pending';
    END IF;

    -- Only notify if the joiner is NOT the admin himself AND admin has enabled this notification
    -- OR if it was via invitation (to confirm acceptance)
    IF NEW.user_id <> _group_admin_id THEN
        IF EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = _group_admin_id
              AND COALESCE((notification_settings->>'new_member')::boolean, true) = true
        ) THEN
            INSERT INTO public.notifications (user_id, title, message, type, data)
            VALUES (
                _group_admin_id,
                CASE WHEN _invitation_exists THEN 'Convite aceito!' ELSE 'Novo membro no grupo!' END,
                CASE WHEN _invitation_exists
                     THEN _joiner_name || ' aceitou o convite e entrou no grupo ' || _group_name
                     ELSE _joiner_name || ' acabou de entrar no grupo ' || _group_name
                END,
                CASE WHEN _invitation_exists THEN 'success' ELSE 'info' END,
                jsonb_build_object('group_id', NEW.group_id, 'user_id', NEW.user_id, 'via_invitation', _invitation_exists)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
