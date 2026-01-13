-- ============================================
-- MIGRATION: Fix Join Flow RLS & RPCs
-- ============================================

-- This migration addresses the issue where guests or non-members cannot
-- view group/invitation metadata due to strict RLS policies, preventing them from joining.

-- 1. RPC to get group info by invite code (Secured by knowledge of the code)
CREATE OR REPLACE FUNCTION public.get_group_by_invite_code(p_code TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    join_requires_approval BOOLEAN,
    is_public BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT g.id, g.name, g.join_requires_approval, g.is_public
    FROM public.groups g
    WHERE g.invite_code = p_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_group_by_invite_code IS 'Securely fetch group metadata via invite code without exposing all groups via RLS.';

-- 2. RPC to get invitation info by token (Secured by knowledge of the token)
CREATE OR REPLACE FUNCTION public.get_group_by_invite_token(p_token TEXT)
RETURNS TABLE (
    group_id UUID,
    invited_email TEXT,
    status TEXT,
    expires_at TIMESTAMPTZ,
    group_name TEXT,
    join_requires_approval BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gi.group_id,
        gi.invited_email,
        gi.status,
        gi.expires_at,
        g.name as group_name,
        g.join_requires_approval
    FROM public.group_invitations gi
    JOIN public.groups g ON gi.group_id = g.id
    WHERE gi.invite_token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_group_by_invite_token IS 'Securely fetch invitation and group metadata via invite token without exposing everyone''s emails via RLS.';

-- 3. Update RLS for group_members to allow anyone to check their own membership
-- This is necessary for the join page to check if the user is already a member
DROP POLICY IF EXISTS "group_members_select_own" ON public.group_members;
CREATE POLICY "group_members_select_own"
    ON public.group_members FOR SELECT
    USING (auth.uid() = user_id);

-- 4. Ensure groups table allows selecting specific rows via the RPC's internal join
-- Actually, SECURITY DEFINER already handles this.

-- 5. Revoke direct SELECT access for anon users on sensitive tables to be safe,
-- though they are already protected by RLS.
-- This is just a reminder that RPCs are now the preferred way for these specific guest actions.
