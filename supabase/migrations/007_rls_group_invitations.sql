-- Migration: RLS Policies for Group Invitations
-- Description: Row Level Security policies for group_invitations table

-- ============================================
-- ENABLE RLS ON GROUP_INVITATIONS
-- ============================================
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- GROUP_INVITATIONS POLICIES
-- ============================================

-- Select: Group members can view invitations, admins can manage
CREATE POLICY "group_invitations_select_members"
    ON public.group_invitations FOR SELECT
    USING (is_group_member(group_id));

-- Insert: Only group admins can create invitations
CREATE POLICY "group_invitations_insert_admin"
    ON public.group_invitations FOR INSERT
    WITH CHECK (is_group_admin(group_id) AND auth.uid() = invited_by);

-- Update: Group admins can update invitation status
CREATE POLICY "group_invitations_update_admin"
    ON public.group_invitations FOR UPDATE
    USING (is_group_admin(group_id))
    WITH CHECK (is_group_admin(group_id));

-- Delete: Group admins can delete pending invitations
CREATE POLICY "group_invitations_delete_admin"
    ON public.group_invitations FOR DELETE
    USING (is_group_admin(group_id) AND status = 'pending');