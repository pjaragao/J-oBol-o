-- Migration: 008_enable_missing_rls.sql
-- Description: Enable Row Level Security (RLS) on transactions and sync_logs tables

-- 1. Habilitar RLS nas tabelas
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS PARA A TABELA TRANSACTIONS
-- ============================================

-- Regra de Leitura (SELECT):
-- Um usuário autenticado comum só pode ver suas próprias transações.
-- Administradores (usando a função pública existente is_admin()) podem ler todas.
CREATE POLICY "transactions_select_visible" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Regra de Inserção (INSERT):
-- Usuários autenticados comuns podem inserir transações em seu próprio nome (ex: criar taxa de entrada).
CREATE POLICY "transactions_insert_own" ON public.transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Regra Geral para Admins (UPDATE/DELETE/ALL):
-- Somente administradores do sistema podem atualizar ou deletar transações.
CREATE POLICY "transactions_manage_admin" ON public.transactions
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================
-- POLÍTICAS PARA A TABELA SYNC_LOGS
-- ============================================

-- Regra de Leitura (SELECT):
-- Apenas administradores do sistema podem visualizar logs de sincronização.
CREATE POLICY "sync_logs_select_admin" ON public.sync_logs
    FOR SELECT USING (public.is_admin());

-- Regra de Inserção (INSERT):
-- Apenas administradores podem inserir manualmente logs de sincronização.
CREATE POLICY "sync_logs_insert_admin" ON public.sync_logs
    FOR INSERT WITH CHECK (public.is_admin());

-- Regra Geral para Admins (ALL):
-- Somente administradores podem realizar qualquer outra operação na tabela.
CREATE POLICY "sync_logs_manage_admin" ON public.sync_logs
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
