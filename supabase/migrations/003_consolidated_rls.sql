-- Migration: 003_consolidated_rls.sql
-- Description: Consolidated Row Level Security Policies

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = TRUE OR is_super_admin = TRUE)); END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_group_member(group_uuid UUID) RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_uuid AND user_id = auth.uid()); END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_group_admin(group_uuid UUID) RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_uuid AND user_id = auth.uid() AND role = 'admin'); END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- TEAMS/EVENTS/MATCHES (Global Read)
CREATE POLICY "teams_select_all" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams_manage_admin" ON public.teams FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "events_select_all" ON public.events FOR SELECT USING (true);
CREATE POLICY "events_manage_admin" ON public.events FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "matches_select_all" ON public.matches FOR SELECT USING (true);
CREATE POLICY "matches_manage_admin" ON public.matches FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- GROUPS (019)
CREATE POLICY "groups_select_visible" ON public.groups FOR SELECT USING (
    is_public = TRUE OR is_group_member(id) OR is_admin() 
    OR EXISTS (SELECT 1 FROM public.pending_members pm WHERE pm.group_id = groups.id AND pm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_invitations gi WHERE gi.group_id = groups.id AND (gi.invited_email = auth.jwt()->>'email' OR gi.invite_token IS NOT NULL))
);
CREATE POLICY "groups_insert_authenticated" ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "groups_manage_admin" ON public.groups FOR ALL USING (is_group_admin(id) OR is_admin()) WITH CHECK (is_group_admin(id) OR is_admin());

-- GROUP MEMBERS (019 + 016)
CREATE POLICY "group_members_select_members" ON public.group_members FOR SELECT USING (
    is_group_member(group_id) OR is_admin() OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.pending_members pm WHERE pm.group_id = group_members.group_id AND pm.user_id = auth.uid())
);
CREATE POLICY "group_members_insert_self" ON public.group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "group_members_manage_admin" ON public.group_members FOR ALL USING (is_group_admin(group_id) OR is_admin()) WITH CHECK (is_group_admin(group_id) OR is_admin());
CREATE POLICY "group_members_delete_self" ON public.group_members FOR DELETE USING (auth.uid() = user_id);

-- PENDING MEMBERS (017)
CREATE POLICY "pending_members_select" ON public.pending_members FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = pending_members.group_id AND gm.user_id = auth.uid())
);
CREATE POLICY "pending_members_insert" ON public.pending_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pending_members_update" ON public.pending_members FOR UPDATE USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = pending_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin')
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = pending_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin')
    OR (auth.uid() = user_id AND status = 'pending')
);
CREATE POLICY "pending_members_delete" ON public.pending_members FOR DELETE USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = pending_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin')
);

-- GROUP INVITATIONS (007)
CREATE POLICY "group_invitations_select_members" ON public.group_invitations FOR SELECT USING (is_group_member(group_id));
CREATE POLICY "group_invitations_insert_admin" ON public.group_invitations FOR INSERT WITH CHECK (is_group_admin(group_id) AND auth.uid() = invited_by);
CREATE POLICY "group_invitations_update_admin" ON public.group_invitations FOR UPDATE USING (is_group_admin(group_id)) WITH CHECK (is_group_admin(group_id));
CREATE POLICY "group_invitations_delete_admin" ON public.group_invitations FOR DELETE USING (is_group_admin(group_id) AND status = 'pending');

-- BETS
CREATE POLICY "bets_select_visible" ON public.bets FOR SELECT USING (
    user_id = auth.uid() 
    OR (is_group_member(group_id) AND EXISTS (SELECT 1 FROM public.matches WHERE id = match_id AND match_date <= NOW())) 
    OR is_admin()
);
CREATE POLICY "bets_insert_before_match" ON public.bets FOR INSERT WITH CHECK (
    auth.uid() = user_id AND is_group_member(group_id) AND EXISTS (SELECT 1 FROM public.matches WHERE id = match_id AND match_date > NOW())
);
CREATE POLICY "bets_update_own_before_match" ON public.bets FOR UPDATE USING (
    auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.matches WHERE id = match_id AND match_date > NOW())
);

-- NOTIFICATIONS
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_system" ON public.notifications FOR INSERT WITH CHECK (true);
