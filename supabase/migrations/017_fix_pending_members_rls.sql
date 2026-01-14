-- Fix RLS for pending_members to allow users to upsert their own requests
-- and ensure they can select them properly.

-- 1. Drop old policies to recreate them cleanly
DROP POLICY IF EXISTS "pending_members_select_members" ON public.pending_members;
DROP POLICY IF EXISTS "pending_members_insert_self" ON public.pending_members;
DROP POLICY IF EXISTS "pending_members_update_admin" ON public.pending_members;

-- 2. Re-create SELECT policy
-- Allow users to see their own requests and group members to see requests for their group
CREATE POLICY "pending_members_select" ON public.pending_members
    FOR SELECT USING (
        auth.uid() = user_id 
        OR EXISTS (
            SELECT 1 FROM public.group_members gm 
            WHERE gm.group_id = pending_members.group_id 
            AND gm.user_id = auth.uid()
        )
    );

-- 3. Re-create INSERT policy
-- Allow users to insert their own request
CREATE POLICY "pending_members_insert" ON public.pending_members
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

-- 4. Re-create UPDATE policy
-- Allow group admins to update status
-- Allow users to update their own request ONLY if it doesn't change the status (for upserts)
CREATE POLICY "pending_members_update" ON public.pending_members
    FOR UPDATE USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.group_members gm 
            WHERE gm.group_id = pending_members.group_id 
            AND gm.user_id = auth.uid() 
            AND gm.role = 'admin'
        )
    )
    WITH CHECK (
        -- Admins can change status
        EXISTS (
            SELECT 1 FROM public.group_members gm 
            WHERE gm.group_id = pending_members.group_id 
            AND gm.user_id = auth.uid() 
            AND gm.role = 'admin'
        )
        -- Users can only "update" if they keep it pending (e.g. re-joining)
        OR (auth.uid() = user_id AND status = 'pending')
    );

-- 5. Re-create DELETE policy
-- Allow admins or the user themselves to delete their request
CREATE POLICY "pending_members_delete" ON public.pending_members
    FOR DELETE USING (
        auth.uid() = user_id 
        OR EXISTS (
            SELECT 1 FROM public.group_members gm 
            WHERE gm.group_id = pending_members.group_id 
            AND gm.user_id = auth.uid() 
            AND gm.role = 'admin'
        )
    );
