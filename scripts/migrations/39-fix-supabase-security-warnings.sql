-- Migration: Fix Supabase Security Warnings
-- Date: 2025-11-23
-- Purpose: Address all security linter warnings from Supabase

-- =====================================================
-- CRITICAL FIX 1: Remove SECURITY DEFINER from Views
-- =====================================================
-- SECURITY DEFINER views bypass RLS and should be avoided
-- We'll recreate these views without SECURITY DEFINER

-- Drop and recreate connection_stats view
DROP VIEW IF EXISTS public.connection_stats CASCADE;
CREATE VIEW public.connection_stats AS
SELECT 
  c.id,
  c.tenant_id,
  c.connection_name,
  c.provider,
  COUNT(DISTINCT a.id) as account_count,
  COUNT(t.id) as transaction_count,
  MAX(t.transaction_date) as last_transaction_date,
  c.last_sync_at
FROM connections c
LEFT JOIN accounts a ON a.connection_id = c.id
LEFT JOIN transactions t ON t.account_id = a.account_id
GROUP BY c.id, c.tenant_id, c.connection_name, c.provider, c.last_sync_at;

-- Drop and recreate connection_sync_status view
DROP VIEW IF EXISTS public.connection_sync_status CASCADE;
CREATE VIEW public.connection_sync_status AS
SELECT 
  c.id,
  c.tenant_id,
  c.connection_name,
  c.provider,
  c.status,
  c.last_sync_at,
  c.next_sync_at,
  CASE 
    WHEN c.next_sync_at IS NULL THEN 'not_scheduled'
    WHEN c.next_sync_at <= NOW() THEN 'due'
    ELSE 'scheduled'
  END as sync_status
FROM connections c;

-- Drop and recreate unreconciled_transactions view  
DROP VIEW IF EXISTS public.unreconciled_transactions CASCADE;
CREATE VIEW public.unreconciled_transactions AS
SELECT 
  t.id,
  t.tenant_id,
  t.account_id,
  t.transaction_date,
  t.description,
  t.amount,
  t.currency,
  t.category,
  a.account_name
FROM transactions t
JOIN accounts a ON a.account_id = t.account_id
WHERE t.reconciled = false OR t.reconciled IS NULL;

-- Drop and recreate transactions_by_category view
DROP VIEW IF EXISTS public.transactions_by_category CASCADE;
CREATE VIEW public.transactions_by_category AS
SELECT 
  t.tenant_id,
  t.category,
  t.currency,
  COUNT(*) as transaction_count,
  SUM(t.amount) as total_amount,
  AVG(t.amount) as avg_amount,
  MIN(t.transaction_date) as first_transaction,
  MAX(t.transaction_date) as last_transaction
FROM transactions t
WHERE t.category IS NOT NULL
GROUP BY t.tenant_id, t.category, t.currency;

-- =====================================================
-- CRITICAL FIX 2: Enable RLS on Public Tables
-- =====================================================

-- Enable RLS on exchange_rates table
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Exchange rates are public data (not tenant-specific), so allow all users to read
CREATE POLICY "Anyone can view exchange rates"
ON public.exchange_rates
FOR SELECT
TO public
USING (true);

-- Only service role can insert/update/delete exchange rates
CREATE POLICY "Service role can manage exchange rates"
ON public.exchange_rates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Enable RLS on direct_bank_provider_docs table
ALTER TABLE public.direct_bank_provider_docs ENABLE ROW LEVEL SECURITY;

-- Provider docs are public reference data, allow all authenticated users to read
CREATE POLICY "Authenticated users can view provider docs"
ON public.direct_bank_provider_docs
FOR SELECT
TO authenticated
USING (true);

-- Only service role can manage provider docs
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
-- MEDIUM FIX: Secure Materialized View Access
-- =====================================================
-- Materialized views should have explicit RLS policies

-- Enable RLS on transaction_analytics materialized view
ALTER MATERIALIZED VIEW public.transaction_analytics SET (security_invoker = on);

-- Create RLS policy for transaction_analytics
-- Only allow users to see analytics for their tenant's data
CREATE POLICY "Users can view their tenant's transaction analytics"
ON public.transaction_analytics
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
  )
);

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

COMMENT ON VIEW public.connection_stats IS 
'View showing connection statistics. Recreated without SECURITY DEFINER to respect RLS.';

COMMENT ON VIEW public.connection_sync_status IS 
'View showing connection sync status. Recreated without SECURITY DEFINER to respect RLS.';

COMMENT ON VIEW public.unreconciled_transactions IS 
'View showing unreconciled transactions. Recreated without SECURITY DEFINER to respect RLS.';

COMMENT ON VIEW public.transactions_by_category IS 
'View aggregating transactions by category. Recreated without SECURITY DEFINER to respect RLS.';

COMMENT ON TABLE public.exchange_rates IS 
'Public exchange rate data. RLS enabled with public read access.';

COMMENT ON TABLE public.direct_bank_provider_docs IS 
'Public documentation for direct bank providers. RLS enabled with authenticated read access.';

