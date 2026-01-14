-- Migration: Fix Group and Member Visibility for Pending Users
-- Description: Allows users with pending requests to see the group info and member counts.

-- 1. Update groups SELECT policy
DROP POLICY IF EXISTS "groups_select_visible" ON public.groups;
CREATE POLICY "groups_select_visible"
    ON public.groups FOR SELECT
    USING (
        is_public = TRUE 
        OR is_group_member(id) 
        OR is_admin()
        OR EXISTS (
            SELECT 1 FROM public.pending_members pm 
            WHERE pm.group_id = groups.id AND pm.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.group_invitations gi
            WHERE gi.group_id = groups.id AND (gi.invited_email = auth.jwt()->>'email' OR gi.invite_token IS NOT NULL)
        )
    );

-- 2. Update group_members SELECT policy (to allow seeing member count in header)
DROP POLICY IF EXISTS "group_members_select_members" ON public.group_members;
CREATE POLICY "group_members_select_members"
    ON public.group_members FOR SELECT
    USING (
        is_group_member(group_id) 
        OR is_admin()
        OR EXISTS (
            SELECT 1 FROM public.pending_members pm 
            WHERE pm.group_id = group_members.group_id AND pm.user_id = auth.uid()
        )
    );
