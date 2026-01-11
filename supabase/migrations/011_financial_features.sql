-- Migration: Financial Features & Betting Rules
-- Description: Adds tables and columns for Paid Groups, Fees, and Betting Security

-- ============================================
-- 1. EVENTS TABLE UPDATES (Fee Config)
-- ============================================
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS hosting_fee DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS online_fee_percent DECIMAL(5, 2) DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS offline_fee_per_slot DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS offline_base_fee DECIMAL(10, 2) DEFAULT 0.00;

COMMENT ON COLUMN public.events.hosting_fee IS 'Legacy: Fixed hosting fee (deprecated by slots logic but kept for safety)';
COMMENT ON COLUMN public.events.online_fee_percent IS 'Percentage retained by platform for Online groups';
COMMENT ON COLUMN public.events.offline_fee_per_slot IS 'Fee per participant slot for Offline groups';
COMMENT ON COLUMN public.events.offline_base_fee IS 'Base fee for creating an Offline group';


-- ============================================
-- 2. GROUPS TABLE UPDATES (Financial Rules)
-- ============================================
-- Create ENUM for Payment Method if not exists (using checking)
DO $$ BEGIN
    CREATE TYPE public.payment_method_type AS ENUM ('ONLINE', 'OFFLINE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS payment_method payment_method_type DEFAULT 'ONLINE',
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS entry_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_members INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS max_members INTEGER, -- Nullable for Online, Required for Offline enforcement logic
ADD COLUMN IF NOT EXISTS prize_distribution_strategy JSONB DEFAULT '{"mode": "WINNER_TAKES_ALL"}'::jsonb;

COMMENT ON COLUMN public.groups.payment_method IS 'ONLINE (Platform holds money) or OFFLINE (Creator holds money)';
COMMENT ON COLUMN public.groups.min_members IS 'Minimum participants required (Default 5)';
COMMENT ON COLUMN public.groups.max_members IS 'Maximum slots. Required for Offline Fee calculation.';


-- ============================================
-- 3. GROUP_MEMBERS UPDATES (Payment Status)
-- ============================================
-- Create ENUM for Payment Status
DO $$ BEGIN
    CREATE TYPE public.payment_status_type AS ENUM ('PENDING', 'PAID', 'EXEMPT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.group_members
ADD COLUMN IF NOT EXISTS payment_status payment_status_type DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;


-- ============================================
-- 4. TRANSACTIONS TABLE (New)
-- ============================================
-- Create ENUM for Transaction Type
DO $$ BEGIN
    CREATE TYPE public.transaction_type AS ENUM ('ENTRY_FEE', 'PRIZE_PAYOUT', 'PLATFORM_FEE_ONLINE', 'CREATOR_ADMISSION_FEE', 'CREATOR_UPGRADE_FEE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create ENUM for Transaction Status
DO $$ BEGIN
    CREATE TYPE public.transaction_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'WAIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id), -- Nullable for system fees? No, usually charged to someone
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status transaction_status DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB -- Store extra info like 'slots_added' for upgrades
);

CREATE INDEX IF NOT EXISTS idx_transactions_group ON public.transactions(group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);

-- Trigger for updated_at on transactions
CREATE OR REPLACE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================
-- 5. BETTING RULES (Security)
-- ============================================
-- This is mostly Logic-level, but we can enforce RLS policies later.
-- For now, no schema changes needed for 'bet_lock' unless we want to persist it per-group vs global.
-- Let's assume global 5min rule for now, or add to groups if needed.
-- Adding constraint to groups just in case we want to customize lock time per group later.
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS bet_lock_minutes INTEGER DEFAULT 5;
