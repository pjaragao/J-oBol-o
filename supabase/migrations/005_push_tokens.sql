-- Migration: Push Tokens (v2)
-- Replaces push_subscriptions with improved schema

-- 1. Create new table with better structure
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device_info JSONB DEFAULT '{}',  -- Browser, OS, etc.
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint on endpoint to prevent duplicates
    CONSTRAINT push_tokens_endpoint_unique UNIQUE (endpoint)
);

-- 2. Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

-- 3. Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Users can view their own tokens
CREATE POLICY "push_tokens_select_own" ON public.push_tokens
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "push_tokens_insert_own" ON public.push_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "push_tokens_update_own" ON public.push_tokens
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "push_tokens_delete_own" ON public.push_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- 5. Migrate existing data from push_subscriptions (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'push_subscriptions') THEN
        INSERT INTO public.push_tokens (user_id, endpoint, p256dh, auth, created_at, last_used_at)
        SELECT user_id, endpoint, p256dh, auth, created_at, updated_at
        FROM public.push_subscriptions
        ON CONFLICT (endpoint) DO NOTHING;
        
        -- Drop old table after migration
        DROP TABLE IF EXISTS public.push_subscriptions;
    END IF;
END $$;

-- 6. Function to update last_used_at
CREATE OR REPLACE FUNCTION public.touch_push_token(p_endpoint TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.push_tokens 
    SET last_used_at = NOW() 
    WHERE endpoint = p_endpoint;
END;
$$;
