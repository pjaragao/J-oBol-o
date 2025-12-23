-- Migration: Add invited_user_id to group_invitations
-- Description: Allows linking an invitation to an existing user profile for better tracking

ALTER TABLE public.group_invitations 
ADD COLUMN IF NOT EXISTS invited_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.group_invitations.invited_user_id IS 'If the invited email belongs to an existing user, this links to their profile.';
