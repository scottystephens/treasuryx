-- Migration: Fix Supabase Security Warnings (Simplified)
-- Date: 2025-11-23
-- Purpose: Address security linter warnings from Supabase
-- Strategy: Fix RLS and search_path issues only, leave views as-is for now

-- =====================================================
-- CRITICAL FIX 1: Enable RLS on Public Tables
-- =====================================================

-- Enable RLS on exchange_rates table
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Exchange rates are public data (not tenant-specific), so allow all users to read
DROP POLICY IF EXISTS "Anyone can view exchange rates" ON public.exchange_rates;
CREATE POLICY "Anyone can view exchange rates"
ON public.exchange_rates
FOR SELECT
TO public
USING (true);

-- Only service role can insert/update/delete exchange rates
DROP POLICY IF EXISTS "Service role can manage exchange rates" ON public.exchange_rates;
CREATE POLICY "Service role can manage exchange rates"
ON public.exchange_rates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Enable RLS on direct_bank_provider_docs table
ALTER TABLE public.direct_bank_provider_docs ENABLE ROW LEVEL SECURITY;

-- Provider docs are public reference data, allow all authenticated users to read
DROP POLICY IF EXISTS "Authenticated users can view provider docs" ON public.direct_bank_provider_docs;
CREATE POLICY "Authenticated users can view provider docs"
ON public.direct_bank_provider_docs
FOR SELECT
TO authenticated
USING (true);

-- Only service role can manage provider docs
DROP POLICY IF EXISTS "Service role can manage provider docs" ON public.direct_bank_provider_docs;
CREATE POLICY "Service role can manage provider docs"
ON public.direct_bank_provider_docs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- MEDIUM FIX: Set search_path on All Functions
-- =====================================================
-- Functions without explicit search_path can be vulnerable to search_path attacks
-- We'll set search_path = public for all affected functions

-- Transaction calculation functions
ALTER FUNCTION public.calculate_net_transaction_amount(uuid) SET search_path = public;
ALTER FUNCTION public.get_transaction_by_reference(text, uuid) SET search_path = public;
ALTER FUNCTION public.recalculate_account_balance(uuid) SET search_path = public;

-- Timestamp update triggers
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_account_updated_at() SET search_path = public;
ALTER FUNCTION public.update_entities_updated_at() SET search_path = public;

-- Sync management functions
ALTER FUNCTION public.mark_sync_complete(uuid, text) SET search_path = public;
ALTER FUNCTION public.schedule_next_sync(uuid) SET search_path = public;
ALTER FUNCTION public.get_connections_due_for_sync() SET search_path = public;
ALTER FUNCTION public.get_connections_ready_for_sync() SET search_path = public;
ALTER FUNCTION public.update_next_sync_time(uuid, timestamp with time zone) SET search_path = public;

-- Token management functions
ALTER FUNCTION public.needs_token_refresh(uuid) SET search_path = public;
ALTER FUNCTION public.mark_token_expired(uuid) SET search_path = public;

-- Provider functions
ALTER FUNCTION public.get_enabled_providers() SET search_path = public;

-- Connection health and stats
ALTER FUNCTION public.calculate_connection_health(uuid) SET search_path = public;
ALTER FUNCTION public.update_connection_health(uuid) SET search_path = public;
ALTER FUNCTION public.update_connection_stats(uuid) SET search_path = public;
ALTER FUNCTION public.trigger_update_connection_stats() SET search_path = public;
ALTER FUNCTION public.trigger_update_connection_health() SET search_path = public;

-- Admin functions
ALTER FUNCTION public.is_super_admin() SET search_path = public;
ALTER FUNCTION public.get_all_tenants() SET search_path = public;
ALTER FUNCTION public.get_all_connections() SET search_path = public;
ALTER FUNCTION public.log_admin_action(text, text, jsonb) SET search_path = public;

-- Tenant management functions
ALTER FUNCTION public.get_current_tenant_id() SET search_path = public;
ALTER FUNCTION public.create_tenant_with_owner(text, text, text) SET search_path = public;
ALTER FUNCTION public.accept_invitation(uuid) SET search_path = public;

-- =====================================================
-- VERIFY ALL CHANGES
-- =====================================================

-- Check that RLS is enabled on critical tables
DO $$
DECLARE
  table_record RECORD;
  rls_enabled BOOLEAN;
BEGIN
  FOR table_record IN 
    SELECT schemaname, tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    AND tablename IN ('exchange_rates', 'direct_bank_provider_docs')
  LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = table_record.tablename
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = table_record.schemaname);
    
    IF NOT rls_enabled THEN
      RAISE WARNING 'RLS not enabled on %.%', table_record.schemaname, table_record.tablename;
    ELSE
      RAISE NOTICE 'RLS enabled on %.%', table_record.schemaname, table_record.tablename;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.exchange_rates IS 
'Public exchange rate data. RLS enabled with public read access.';

COMMENT ON TABLE public.direct_bank_provider_docs IS 
'Public documentation for direct bank providers. RLS enabled with authenticated read access.';

-- =====================================================
-- NOTE: Views with SECURITY DEFINER
-- =====================================================
-- The following views have SECURITY DEFINER which bypasses RLS:
-- - public.connection_stats
-- - public.connection_sync_status
-- - public.unreconciled_transactions
-- - public.transactions_by_category
--
-- These should be recreated without SECURITY DEFINER in a future migration
-- after testing to ensure the app doesn't break.
-- For now, they are left as-is to maintain functionality.

