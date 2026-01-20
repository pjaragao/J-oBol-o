-- Migration: 001_consolidated_schema.sql
-- Description: Consolidated Schema Definitions (Tables, Indexes, Enums)

-- ============================================
-- ENUMS
-- ============================================

DO $$ BEGIN
    CREATE TYPE public.payment_method_type AS ENUM ('ONLINE', 'OFFLINE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_status_type AS ENUM ('PENDING', 'PAID', 'EXEMPT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.transaction_type AS ENUM ('ENTRY_FEE', 'PRIZE_PAYOUT', 'PLATFORM_FEE_ONLINE', 'CREATOR_ADMISSION_FEE', 'CREATOR_UPGRADE_FEE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.transaction_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'WAIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    short_name TEXT,
    logo_url TEXT,
    api_id INTEGER UNIQUE,
    country TEXT,
    tla TEXT, -- Added from 014
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.teams IS 'Central database of football teams';

-- ============================================
-- PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    nickname TEXT,
    avatar_url TEXT,
    favorite_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    is_super_admin BOOLEAN DEFAULT FALSE,
    notification_settings JSONB DEFAULT '{
        "new_member": true,
        "points_rank": true,
        "rule_change": true,
        "bet_reminder": true
    }'::jsonb,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'pro')),
    subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'canceled', 'past_due')),
    -- Expansion Fields
    full_name TEXT,
    cpf TEXT,
    cep TEXT,
    address_street TEXT,
    address_number TEXT,
    address_complement TEXT,
    address_neighborhood TEXT,
    address_city TEXT,
    address_state TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users';

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'revenuecat')),
    provider_subscription_id TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('premium', 'pro')),
    status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_subscription_id)
);

-- ============================================
-- EVENTS TABLE (Tournaments/Competitions)
-- ============================================
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    display_name TEXT,
    description TEXT,
    season INTEGER,
    start_date DATE,
    end_date DATE,
    api_id INTEGER UNIQUE,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    current_matchday INTEGER, -- Added from 014
    -- Financials (Added from 011)
    hosting_fee DECIMAL(10, 2) DEFAULT 0.00,
    online_fee_percent DECIMAL(5, 2) DEFAULT 10.0,
    offline_fee_per_slot DECIMAL(10, 2) DEFAULT 0.00,
    offline_base_fee DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MATCHES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    home_team_id UUID NOT NULL REFERENCES public.teams(id),
    away_team_id UUID NOT NULL REFERENCES public.teams(id),
    match_date TIMESTAMPTZ NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    score_detailed JSONB, -- Added from 014
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled', 'FT', 'AET', 'PEN', 'TIMED', 'IN_PLAY', 'PAUSED', 'SUSPENDED')), -- Expanded enum used in app code often
    api_id INTEGER UNIQUE,
    round TEXT,
    group_name TEXT,
    venue TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GROUPS TABLE (Betting pools)
-- ============================================
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    event_id UUID NOT NULL REFERENCES public.events(id),
    invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
    is_public BOOLEAN DEFAULT FALSE,
    max_members INTEGER DEFAULT 50, -- Nullable/adjustable
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    scoring_rules JSONB DEFAULT '{"exact": 10, "winner": 5, "goals": 3}'::jsonb,
    requires_premium BOOLEAN DEFAULT FALSE,
    -- Added columns
    allow_member_invites BOOLEAN DEFAULT FALSE, -- 007
    join_requires_approval BOOLEAN DEFAULT FALSE, -- 015
    is_finished BOOLEAN DEFAULT FALSE, -- 013
    finished_at TIMESTAMPTZ, -- 013
    -- Financials (011)
    payment_method payment_method_type DEFAULT 'ONLINE',
    is_paid BOOLEAN DEFAULT FALSE,
    entry_fee DECIMAL(10, 2) DEFAULT 0,
    min_members INTEGER DEFAULT 5,
    prize_distribution_strategy JSONB DEFAULT '{"mode": "WINNER_TAKES_ALL"}'::jsonb,
    bet_lock_minutes INTEGER DEFAULT 5,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GROUP_MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    payment_status payment_status_type DEFAULT 'PENDING',
    paid_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- ============================================
-- PENDING_MEMBERS TABLE (015)
-- ============================================
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

-- ============================================
-- GROUP_INVITATIONS TABLE (006)
-- ============================================
CREATE TABLE IF NOT EXISTS public.group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    invited_email TEXT NOT NULL,
    invited_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Added from 008
    invited_by UUID NOT NULL REFERENCES public.profiles(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(group_id, invited_email, status)
);

-- ============================================
-- BETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    home_score_bet INTEGER NOT NULL CHECK (home_score_bet >= 0),
    away_score_bet INTEGER NOT NULL CHECK (away_score_bet >= 0),
    points INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, group_id, match_id)
);

-- ============================================
-- TRANSACTIONS TABLE (011)
-- ============================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status transaction_status DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SYNC_LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reosurce_type TEXT NOT NULL, -- Keeping legacy typo to avoid breaking code: reosurce_type
    details JSONB,
    status TEXT NOT NULL,
    error_message TEXT,
    created_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON public.profiles(subscription_tier, subscription_status);
CREATE INDEX IF NOT EXISTS idx_matches_event ON public.matches(event_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON public.matches(match_date);
CREATE INDEX IF NOT EXISTS idx_bets_composite ON public.bets(group_id, match_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_group ON public.transactions(group_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
