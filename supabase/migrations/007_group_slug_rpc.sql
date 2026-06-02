-- Migration: 007_group_slug_rpc.sql
-- Description: Create function to resolve group slug to invite code

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.get_group_by_slug(p_slug TEXT)
RETURNS TABLE (id UUID, invite_code TEXT, name TEXT) AS $$
BEGIN
    RETURN QUERY 
    SELECT g.id, g.invite_code, g.name 
    FROM public.groups g 
    WHERE lower(regexp_replace(unaccent(g.name), '[^a-zA-Z0-9]', '', 'g')) = lower(p_slug)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
