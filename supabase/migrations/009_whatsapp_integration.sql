-- Migration: 009_whatsapp_integration.sql
-- Description: Add columns and tables required for WhatsApp integration, news archiving, and chatbot logs, including RLS policies.

-- 1. Alter groups table to support WhatsApp settings
ALTER TABLE public.groups 
    ADD COLUMN IF NOT EXISTS whatsapp_group_jid TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_bot_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS whatsapp_invite_link TEXT;

-- 2. Create whatsapp_links table
CREATE TABLE IF NOT EXISTS public.whatsapp_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    whatsapp_jid TEXT,
    whatsapp_name TEXT,
    link_token TEXT UNIQUE,
    verified BOOLEAN DEFAULT FALSE,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(whatsapp_jid, group_id)
);

-- 3. Create news_articles table
CREATE TABLE IF NOT EXISTS public.news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    url TEXT NOT NULL UNIQUE,
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    tags TEXT[]
);

-- 4. Create chatbot_logs table
CREATE TABLE IF NOT EXISTS public.chatbot_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_jid TEXT NOT NULL,
    sender_jid TEXT,
    command TEXT,
    response_type TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS) on new tables
ALTER TABLE public.whatsapp_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_logs ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies for whatsapp_links
CREATE POLICY "whatsapp_links_select_members" ON public.whatsapp_links
    FOR SELECT USING (
        auth.uid() = user_id 
        OR public.is_group_member(group_id) 
        OR public.is_admin()
    );

CREATE POLICY "whatsapp_links_insert_self" ON public.whatsapp_links
    FOR INSERT WITH CHECK (
        auth.uid() = user_id 
        AND public.is_group_member(group_id)
    );

CREATE POLICY "whatsapp_links_delete_self" ON public.whatsapp_links
    FOR DELETE USING (
        auth.uid() = user_id 
        OR public.is_group_admin(group_id) 
        OR public.is_admin()
    );

-- 7. Create RLS Policies for news_articles (Public read, admin write)
CREATE POLICY "news_articles_select_all" ON public.news_articles
    FOR SELECT USING (true);

CREATE POLICY "news_articles_manage_admin" ON public.news_articles
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8. Create RLS Policies for chatbot_logs (Admin/moderator only, service_role bypasses RLS)
CREATE POLICY "chatbot_logs_select_admin" ON public.chatbot_logs
    FOR SELECT USING (public.is_admin());

CREATE POLICY "chatbot_logs_insert_admin" ON public.chatbot_logs
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "chatbot_logs_manage_admin" ON public.chatbot_logs
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_links_user ON public.whatsapp_links(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_links_group ON public.whatsapp_links(group_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_published ON public.news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_group_jid ON public.chatbot_logs(group_jid);
