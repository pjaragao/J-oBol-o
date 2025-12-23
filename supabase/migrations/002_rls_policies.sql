-- Migration: Row Level Security Policies (Consolidated)
-- Description: Implements RLS for all tables with helper functions and Storage setup

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if current user is a system admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (is_admin = TRUE OR is_super_admin = TRUE)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is a member of a group
CREATE OR REPLACE FUNCTION public.is_group_member(group_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = group_uuid AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is admin of a group
CREATE OR REPLACE FUNCTION public.is_group_admin(group_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = group_uuid AND user_id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user has an active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND subscription_status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's subscription tier
CREATE OR REPLACE FUNCTION public.get_subscription_tier()
RETURNS TEXT AS $$
DECLARE
    tier TEXT;
BEGIN
    SELECT subscription_tier INTO tier 
    FROM public.profiles 
    WHERE id = auth.uid();
    RETURN COALESCE(tier, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Anyone can view profiles
CREATE POLICY "profiles_select_all"
    ON public.profiles FOR SELECT
    USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Profile is created via trigger
CREATE POLICY "profiles_insert_own"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================
-- SUBSCRIPTIONS POLICIES
-- ============================================

-- Users can view their own subscriptions
CREATE POLICY "subscriptions_select_own"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Only service role can manage subscriptions (via webhooks)
CREATE POLICY "subscriptions_insert_service"
    ON public.subscriptions FOR INSERT
    WITH CHECK (false);

CREATE POLICY "subscriptions_update_service"
    ON public.subscriptions FOR UPDATE
    USING (false);

-- ============================================
-- TEAMS POLICIES
-- ============================================

-- Anyone can view teams
CREATE POLICY "teams_select_all"
    ON public.teams FOR SELECT
    USING (true);

-- Only admins can manage teams
CREATE POLICY "teams_manage_admin"
    ON public.teams FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================
-- EVENTS POLICIES
-- ============================================

-- Anyone can view active events
CREATE POLICY "events_select_all"
    ON public.events FOR SELECT
    USING (true);

-- Only admins can manage events
CREATE POLICY "events_manage_admin"
    ON public.events FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================
-- MATCHES POLICIES
-- ============================================

-- Anyone can view matches
CREATE POLICY "matches_select_all"
    ON public.matches FOR SELECT
    USING (true);

-- Only admins can manage matches
CREATE POLICY "matches_manage_admin"
    ON public.matches FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================
-- GROUPS POLICIES
-- ============================================

-- Users can view public groups or groups they're members of
CREATE POLICY "groups_select_visible"
    ON public.groups FOR SELECT
    USING (
        is_public = TRUE 
        OR is_group_member(id) 
        OR is_admin()
    );

-- Authenticated users can create groups
CREATE POLICY "groups_insert_authenticated"
    ON public.groups FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
        AND auth.uid() IS NOT NULL
    );

-- Group admins can update/delete their groups
CREATE POLICY "groups_manage_admin"
    ON public.groups FOR ALL
    USING (is_group_admin(id) OR is_admin())
    WITH CHECK (is_group_admin(id) OR is_admin());

-- ============================================
-- GROUP_MEMBERS POLICIES
-- ============================================

-- Members can view other members of their groups
CREATE POLICY "group_members_select_members"
    ON public.group_members FOR SELECT
    USING (is_group_member(group_id) OR is_admin());

-- Users can join groups (insert themselves)
CREATE POLICY "group_members_insert_self"
    ON public.group_members FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND auth.uid() IS NOT NULL
    );

-- Group admins can manage members
CREATE POLICY "group_members_manage_admin"
    ON public.group_members FOR ALL
    USING (is_group_admin(group_id) OR is_admin())
    WITH CHECK (is_group_admin(group_id) OR is_admin());

-- Users can leave groups
CREATE POLICY "group_members_delete_self"
    ON public.group_members FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- BETS POLICIES
-- ============================================

-- Visibility rules
CREATE POLICY "bets_select_visible"
    ON public.bets FOR SELECT
    USING (
        user_id = auth.uid()
        OR
        (
            is_group_member(group_id) 
            AND EXISTS (
                SELECT 1 FROM public.matches 
                WHERE id = match_id AND match_date <= NOW()
            )
        )
        OR is_admin()
    );

-- Betting rules
CREATE POLICY "bets_insert_before_match"
    ON public.bets FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND is_group_member(group_id)
        AND EXISTS (
            SELECT 1 FROM public.matches 
            WHERE id = match_id AND match_date > NOW()
        )
    );

CREATE POLICY "bets_update_own_before_match"
    ON public.bets FOR UPDATE
    USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.matches 
            WHERE id = match_id AND match_date > NOW()
        )
    );

CREATE POLICY "bets_delete_manage"
    ON public.bets FOR DELETE
    USING (
        auth.uid() = user_id 
        OR is_group_admin(group_id) 
        OR is_admin()
    );

-- ============================================
-- SYNC_LOGS POLICIES
-- ============================================

CREATE POLICY "sync_logs_admin_all"
    ON public.sync_logs FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================

CREATE POLICY "notifications_select_own"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_system"
    ON public.notifications FOR INSERT
    WITH CHECK (true); -- Allow system/triggers to insert

-- ============================================
-- STORAGE SETUP & POLICIES
-- ============================================

-- Ensure buckets exist (run these in SQL editor)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('team-logos', 'team-logos', true) ON CONFLICT (id) DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('competition-logos', 'competition-logos', true) ON CONFLICT (id) DO NOTHING;

-- Public access to read storage
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id IN ('avatars', 'team-logos', 'competition-logos') );

-- Authenticated users manage own avatars
CREATE POLICY "Avatar Auth Manage"
ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'avatars' )
WITH CHECK ( bucket_id = 'avatars' );

-- Admins manage logos
CREATE POLICY "Logos Admin Manage"
ON storage.objects FOR ALL
TO authenticated
USING ( (bucket_id IN ('team-logos', 'competition-logos')) AND is_admin() )
WITH CHECK ( (bucket_id IN ('team-logos', 'competition-logos')) AND is_admin() );
