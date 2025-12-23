-- Migration: Invitation Acceptance Logic
-- Description: Updates the new member notification trigger to handle invitation acceptance

-- ============================================
-- UPDATE TRIGGER: HANDLE INVITATION ACCEPTANCE
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_group_member_notification()
RETURNS TRIGGER AS $$
DECLARE
    group_admin_id UUID;
    group_name TEXT;
    joiner_name TEXT;
    invited_email TEXT;
    invitation_exists BOOLEAN := FALSE;
BEGIN
    -- Get group name
    SELECT name INTO group_name FROM public.groups WHERE id = NEW.group_id;

    -- Get joiner name and email
    SELECT COALESCE(display_name, email), email INTO joiner_name, invited_email
    FROM public.profiles WHERE id = NEW.user_id;

    -- Get group admin (the creator)
    SELECT created_by INTO group_admin_id FROM public.groups WHERE id = NEW.group_id;

    -- Check if there's a pending invitation for this email and group
    SELECT EXISTS(
        SELECT 1 FROM public.group_invitations
        WHERE group_id = NEW.group_id
          AND invited_email = invited_email
          AND status = 'pending'
          AND expires_at > NOW()
    ) INTO invitation_exists;

    -- If invitation exists, accept it
    IF invitation_exists THEN
        UPDATE public.group_invitations
        SET status = 'accepted', accepted_at = NOW()
        WHERE group_id = NEW.group_id
          AND invited_email = invited_email
          AND status = 'pending';
    END IF;

    -- Only notify if the joiner is NOT the admin himself AND admin has enabled this notification
    -- OR if it was via invitation (to confirm acceptance)
    IF NEW.user_id <> group_admin_id THEN
        IF EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = group_admin_id
              AND COALESCE((notification_settings->>'new_member')::boolean, true) = true
        ) THEN
            INSERT INTO public.notifications (user_id, title, message, type, data)
            VALUES (
                group_admin_id,
                CASE WHEN invitation_exists THEN 'Convite aceito!' ELSE 'Novo membro no grupo!' END,
                CASE WHEN invitation_exists
                     THEN joiner_name || ' aceitou o convite e entrou no grupo ' || group_name
                     ELSE joiner_name || ' acabou de entrar no grupo ' || group_name
                END,
                CASE WHEN invitation_exists THEN 'success' ELSE 'info' END,
                jsonb_build_object('group_id', NEW.group_id, 'user_id', NEW.user_id, 'via_invitation', invitation_exists)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;