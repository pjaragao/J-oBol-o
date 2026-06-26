-- Migration: 011_add_knockout_only_to_groups.sql
-- Description: Add knockout_only flag to groups table

ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS knockout_only BOOLEAN DEFAULT FALSE;
