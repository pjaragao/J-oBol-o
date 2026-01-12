-- Migration: Group Closure Status
-- Description: Adds columns to track when a group is finalized/closed.

ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS is_finished BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

COMMENT ON COLUMN public.groups.is_finished IS 'True if the bolão has been finalized and prizes distributed';
COMMENT ON COLUMN public.groups.finished_at IS 'When the bolão was marked as finished';
