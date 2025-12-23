-- Migration: Add invitation control to groups
-- Description: Adds a setting to control if any member can invite others

ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS allow_member_invites BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.groups.allow_member_invites IS 'If true, any member of the group can invite others. If false, only admins can.';
