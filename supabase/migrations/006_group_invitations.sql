-- Migration: Group Invitations System
-- Description: Adds table for email-based group invitations

-- ============================================
-- GROUP_INVITATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    invited_email TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES public.profiles(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(group_id, invited_email, status) -- Prevent duplicate pending invites for same email in group
);

COMMENT ON TABLE public.group_invitations IS 'Email invitations for joining groups';
COMMENT ON COLUMN public.group_invitations.invite_token IS 'Secure token for accepting invitations';
COMMENT ON COLUMN public.group_invitations.expires_at IS 'Invitations expire after 7 days';

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_group_invitations_group ON public.group_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_email ON public.group_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_group_invitations_token ON public.group_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_group_invitations_status ON public.group_invitations(status);
CREATE INDEX IF NOT EXISTS idx_group_invitations_expires ON public.group_invitations(expires_at);

-- ============================================
-- TRIGGER: AUTO-EXPIRE INVITATIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark expired invitations
    UPDATE public.group_invitations
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on new invitation to clean up expired ones
CREATE OR REPLACE TRIGGER cleanup_expired_invitations
    AFTER INSERT ON public.group_invitations
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.expire_old_invitations();