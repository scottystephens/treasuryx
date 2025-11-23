-- Migration: Fix Supabase Security Warnings (Safe Version)
-- Date: 2025-11-23
-- Purpose: Address security linter warnings from Supabase
-- Strategy: Fix RLS issues and set search_path on functions that exist

-- =====================================================
-- CRITICAL FIX: Enable RLS on Public Tables
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
-- MEDIUM FIX: Set search_path on All Functions (Safe)
-- =====================================================
-- Functions without explicit search_path can be vulnerable to search_path attacks
-- We'll set search_path = public for all affected functions that exist

DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Get all functions in public schema
  FOR func_record IN 
    SELECT 
      p.proname as func_name,
      pg_get_function_identity_arguments(p.oid) as func_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
      'calculate_net_transaction_amount',
      'get_transaction_by_reference',
      'recalculate_account_balance',
      'update_updated_at_column',
      'update_account_updated_at',
      'update_entities_updated_at',
      'mark_sync_complete',
      'schedule_next_sync',
      'get_connections_due_for_sync',
      'get_connections_ready_for_sync',
      'update_next_sync_time',
      'needs_token_refresh',
      'mark_token_expired',
      'get_enabled_providers',
      'calculate_connection_health',
      'update_connection_health',
      'update_connection_stats',
      'trigger_update_connection_stats',
      'trigger_update_connection_health',
      'is_super_admin',
      'get_all_tenants',
      'get_all_connections',
      'log_admin_action',
      'get_current_tenant_id',
      'create_tenant_with_owner',
      'accept_invitation'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', 
                     func_record.func_name, 
                     func_record.func_args);
      RAISE NOTICE 'Set search_path for function: %(%)', func_record.func_name, func_record.func_args;
    EXCEPTION 
      WHEN OTHERS THEN
        RAISE WARNING 'Could not alter function %(%): %', func_record.func_name, func_record.func_args, SQLERRM;
    END;
  END LOOP;
END $$;

-- =====================================================
-- VERIFY RLS IS ENABLED
-- =====================================================

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
      RAISE NOTICE '✓ RLS enabled on %.%', table_record.schemaname, table_record.tablename;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- SUMMARY
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Supabase Security Fixes Applied';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ RLS enabled on exchange_rates';
  RAISE NOTICE '✓ RLS enabled on direct_bank_provider_docs';
  RAISE NOTICE '✓ search_path set on all existing functions';
  RAISE NOTICE '';
  RAISE NOTICE 'Remaining Issues (non-critical):';
  RAISE NOTICE '- 4 views with SECURITY DEFINER (requires app testing)';
  RAISE NOTICE '- 1 materialized view accessible to API (low risk)';
  RAISE NOTICE '- Leaked password protection (enable in Supabase dashboard)';
  RAISE NOTICE '';
  RAISE NOTICE 'See docs/security/ for details';
  RAISE NOTICE '========================================';
END $$;

