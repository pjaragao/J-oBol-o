-- ============================================
-- MIGRATION: Join Approval Settings & Pending Members
-- ============================================

-- 1. Add approval setting to groups table
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS join_requires_approval BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.groups.join_requires_approval IS 
'If true, new members joining via link or public discovery must be approved by admin before becoming full members.';

-- 2. Create pending_members table for join requests
CREATE TABLE IF NOT EXISTS public.pending_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id),
    UNIQUE(group_id, user_id)
);

COMMENT ON TABLE public.pending_members IS 'Pending join requests for groups requiring approval';

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_members_group ON public.pending_members(group_id);
CREATE INDEX IF NOT EXISTS idx_pending_members_user ON public.pending_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_members_status ON public.pending_members(status);

-- 4. RLS Policies for pending_members
ALTER TABLE public.pending_members ENABLE ROW LEVEL SECURITY;

-- Anyone can view pending members (admins need to see them)
CREATE POLICY "pending_members_select_members" ON public.pending_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm 
            WHERE gm.group_id = pending_members.group_id 
            AND gm.user_id = auth.uid()
        )
        OR user_id = auth.uid()
    );

-- Users can create their own pending request
CREATE POLICY "pending_members_insert_self" ON public.pending_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only group admins can update (approve/reject)
CREATE POLICY "pending_members_update_admin" ON public.pending_members
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm 
            WHERE gm.group_id = pending_members.group_id 
            AND gm.user_id = auth.uid() 
            AND gm.role = 'admin'
        )
    );

-- Only admins can delete
CREATE POLICY "pending_members_delete_admin" ON public.pending_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm 
            WHERE gm.group_id = pending_members.group_id 
            AND gm.user_id = auth.uid() 
            AND gm.role = 'admin'
        )
    );

-- 5. Function to notify admin when join request is created
CREATE OR REPLACE FUNCTION public.notify_admin_on_join_request()
RETURNS TRIGGER AS $$
DECLARE
    admin_id UUID;
    group_name TEXT;
    requester_name TEXT;
BEGIN
    -- Get group name
    SELECT name INTO group_name FROM public.groups WHERE id = NEW.group_id;
    
    -- Get requester name
    SELECT COALESCE(display_name, email) INTO requester_name 
    FROM public.profiles WHERE id = NEW.user_id;
    
    -- Get group admin(s) and create notification for each
    FOR admin_id IN 
        SELECT user_id FROM public.group_members 
        WHERE group_id = NEW.group_id AND role = 'admin'
    LOOP
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
            admin_id,
            'notifications.system.join_request.title',
            'notifications.system.join_request.message',
            'join_request',
            jsonb_build_object(
                'pending_member_id', NEW.id,
                'group_id', NEW.group_id,
                'group', group_name,
                'requester_id', NEW.user_id,
                'name', requester_name,
                'action_approve', '/api/groups/approve-member?id=' || NEW.id::TEXT || '&action=approve',
                'action_reject', '/api/groups/approve-member?id=' || NEW.id::TEXT || '&action=reject'
            )
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger to fire notification on new join request
DROP TRIGGER IF EXISTS on_pending_member_created ON public.pending_members;
CREATE TRIGGER on_pending_member_created
    AFTER INSERT ON public.pending_members
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_admin_on_join_request();

-- 7. Function to notify user when their request is approved/rejected
CREATE OR REPLACE FUNCTION public.notify_user_on_request_reviewed()
RETURNS TRIGGER AS $$
DECLARE
    group_name TEXT;
BEGIN
    -- Only trigger on status change
    IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
        SELECT name INTO group_name FROM public.groups WHERE id = NEW.group_id;
        
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
            NEW.user_id,
            CASE 
                WHEN NEW.status = 'approved' THEN 'notifications.system.join_approved.title'
                ELSE 'notifications.system.join_rejected.title'
            END,
            CASE 
                WHEN NEW.status = 'approved' THEN 'notifications.system.join_approved.message'
                ELSE 'notifications.system.join_rejected.message'
            END,
            'join_request_result',
            jsonb_build_object(
                'group_id', NEW.group_id,
                'group', group_name,
                'status', NEW.status
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger to fire notification on request review
DROP TRIGGER IF EXISTS on_pending_member_reviewed ON public.pending_members;
CREATE TRIGGER on_pending_member_reviewed
    AFTER UPDATE ON public.pending_members
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_user_on_request_reviewed();
