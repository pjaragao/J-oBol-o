-- CLEANUP SCRIPT: Removes all football data to avoid conflicts
-- WARNING: This will delete all Groups, Bets, Matches, Events and Teams.
-- Users/Profiles remain intact, but their favorite_team_id will be reset.

BEGIN;

-- 1. Remove references from profiles
UPDATE public.profiles SET favorite_team_id = NULL;

-- 2. Delete data dependent on matches/groups
DELETE FROM public.bets;
DELETE FROM public.group_members;

-- 3. Delete groups (depends on events)
DELETE FROM public.groups;

-- 4. Delete matches (depends on events and teams)
DELETE FROM public.matches;

-- 5. Delete events (now safe to delete)
DELETE FROM public.events;

-- 6. Delete teams (now safe to delete)
DELETE FROM public.teams;

COMMIT;
