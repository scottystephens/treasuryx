-- =====================================================
-- Migration 23: Enhance Provider Transactions Architecture
-- Purpose: Add indexes, constraints, and enriched view for complete provider data visibility
-- Date: 2024-11-16
-- =====================================================

-- =====================================================
-- STEP 1: Add Indexes for Performance
-- =====================================================

-- Speed up joins between provider_transactions and transactions
CREATE INDEX IF NOT EXISTS idx_provider_transactions_transaction_id 
  ON provider_transactions(transaction_id) 
  WHERE transaction_id IS NOT NULL;

-- Speed up provider-specific queries
CREATE INDEX IF NOT EXISTS idx_provider_transactions_provider_metadata 
  ON provider_transactions USING GIN (provider_metadata);

-- Speed up queries by provider
CREATE INDEX IF NOT EXISTS idx_provider_transactions_provider_id 
  ON provider_transactions(provider_id);

-- Speed up queries by external transaction ID (for deduplication)
CREATE INDEX IF NOT EXISTS idx_provider_transactions_external_id 
  ON provider_transactions(external_transaction_id);

-- Speed up date range queries
CREATE INDEX IF NOT EXISTS idx_provider_transactions_transaction_date 
  ON provider_transactions(transaction_date DESC);

-- Composite index for common queries (tenant + connection + date)
CREATE INDEX IF NOT EXISTS idx_provider_transactions_tenant_connection_date 
  ON provider_transactions(tenant_id, connection_id, transaction_date DESC);

-- =====================================================
-- STEP 2: Ensure Referential Integrity
-- =====================================================

-- Ensure foreign key constraint exists
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE provider_transactions 
    DROP CONSTRAINT IF EXISTS provider_transactions_transaction_id_fkey;
  
  -- Add constraint with proper ON DELETE behavior
  ALTER TABLE provider_transactions 
    ADD CONSTRAINT provider_transactions_transaction_id_fkey 
      FOREIGN KEY (transaction_id) 
      REFERENCES transactions(transaction_id) 
      ON DELETE SET NULL;
  
  RAISE NOTICE 'Added foreign key constraint for transaction_id';
END $$;

-- =====================================================
-- STEP 3: Create Enriched Transaction View
-- =====================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS transactions_enriched CASCADE;

-- Create enriched view that combines normalized + provider-specific data
CREATE OR REPLACE VIEW transactions_enriched AS
SELECT 
  -- All fields from transactions table (normalized data)
  t.transaction_id,
  t.account_id,
  t.date,
  t.description,
  t.amount,
  t.currency,
  t.type,
  t.category,
  t.status,
  t.reference,
  t.created_at,
  t.updated_at,
  
  -- Additional transaction fields (if they exist)
  t.running_balance,
  t.reference_number,
  t.check_number,
  t.counterparty_name,
  t.counterparty_account,
  t.bank_reference,
  t.transaction_code,
  t.memo,
  t.sub_category,
  t.merchant_name,
  t.merchant_category_code,
  t.location,
  t.original_amount,
  t.original_currency,
  t.fee_amount,
  t.tax_amount,
  t.reconciliation_status,
  
  -- Provider information
  pt.provider_id,
  pt.connection_id,
  pt.external_transaction_id,
  pt.provider_account_id,
  
  -- Provider-specific metadata (complete JSONB)
  pt.provider_metadata,
  
  -- Extracted commonly-used provider fields for easier querying
  pt.provider_metadata->>'booking_status' as booking_status,
  pt.provider_metadata->>'value_date' as value_date,
  pt.provider_metadata->>'original_date' as original_date,
  pt.provider_metadata->>'transaction_type' as transaction_type_code,
  pt.provider_metadata->>'transaction_code' as provider_transaction_code,
  pt.provider_metadata->>'category_id' as category_id,
  pt.provider_metadata->>'notes' as notes,
  pt.provider_metadata->>'status' as provider_status,
  pt.provider_metadata->>'merchant_category_code' as provider_merchant_category_code,
  pt.provider_metadata->>'merchant_location' as merchant_location,
  pt.provider_metadata->>'provider_transaction_id' as provider_transaction_id,
  
  -- Import metadata
  pt.transaction_date as provider_transaction_date,
  pt.posted_date as provider_posted_date,
  pt.import_status,
  pt.import_job_id,
  pt.import_error,
  
  -- Flag to indicate if this is a provider-synced transaction
  CASE WHEN pt.id IS NOT NULL THEN true ELSE false END as is_provider_synced

FROM transactions t
LEFT JOIN provider_transactions pt ON pt.transaction_id = t.transaction_id;

-- Add comment explaining the view
COMMENT ON VIEW transactions_enriched IS 
  'Enriched transaction view combining normalized transaction data with provider-specific metadata. 
   Use this view when you need access to provider-specific fields like booking status, value dates, 
   transaction codes, etc. Falls back gracefully for manual/CSV transactions.';

-- =====================================================
-- STEP 4: Create Helper Functions
-- =====================================================

-- Function to get transaction with full provider context
CREATE OR REPLACE FUNCTION get_transaction_with_provider_context(
  p_transaction_id TEXT
)
RETURNS TABLE (
  transaction_data JSONB,
  provider_data JSONB,
  is_synced BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    row_to_json(t.*)::jsonb as transaction_data,
    pt.provider_metadata as provider_data,
    (pt.id IS NOT NULL) as is_synced
  FROM transactions t
  LEFT JOIN provider_transactions pt ON pt.transaction_id = t.transaction_id
  WHERE t.transaction_id = p_transaction_id;
END;
$$;

-- Function to check if transaction is pending (based on provider metadata)
CREATE OR REPLACE FUNCTION is_transaction_pending(
  p_transaction_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_booking_status TEXT;
BEGIN
  SELECT pt.provider_metadata->>'booking_status'
  INTO v_booking_status
  FROM provider_transactions pt
  WHERE pt.transaction_id = p_transaction_id;
  
  -- Return true if booking_status is 'PENDING', false otherwise
  RETURN COALESCE(v_booking_status = 'PENDING', false);
END;
$$;

-- =====================================================
-- STEP 5: Create Materialized View for Analytics
-- =====================================================

-- Materialized view for faster analytics queries
DROP MATERIALIZED VIEW IF EXISTS transaction_analytics CASCADE;

CREATE MATERIALIZED VIEW transaction_analytics AS
SELECT 
  t.transaction_id,
  t.account_id,
  t.date,
  t.amount,
  t.currency,
  t.type,
  t.category,
  
  -- Provider info
  pt.provider_id,
  pt.connection_id,
  
  -- Extracted metadata for analytics
  pt.provider_metadata->>'booking_status' as booking_status,
  pt.provider_metadata->>'transaction_type' as transaction_type_code,
  pt.provider_metadata->>'category_id' as category_id,
  pt.provider_metadata->>'merchant_category_code' as merchant_category_code,
  
  -- Flags
  CASE WHEN pt.id IS NOT NULL THEN true ELSE false END as is_synced,
  CASE WHEN pt.provider_metadata->>'booking_status' = 'PENDING' THEN true ELSE false END as is_pending,
  
  -- Aggregation helpers
  DATE_TRUNC('month', t.date) as month,
  DATE_TRUNC('week', t.date) as week,
  DATE_TRUNC('year', t.date) as year
  
FROM transactions t
LEFT JOIN provider_transactions pt ON pt.transaction_id = t.transaction_id;

-- Create indexes on materialized view
CREATE INDEX IF NOT EXISTS idx_transaction_analytics_date 
  ON transaction_analytics(date DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_analytics_account 
  ON transaction_analytics(account_id);

CREATE INDEX IF NOT EXISTS idx_transaction_analytics_provider 
  ON transaction_analytics(provider_id) 
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_analytics_month 
  ON transaction_analytics(month DESC);

-- Add comment
COMMENT ON MATERIALIZED VIEW transaction_analytics IS 
  'Materialized view for fast analytics queries. Refresh periodically using: REFRESH MATERIALIZED VIEW transaction_analytics;';

-- =====================================================
-- STEP 6: Add Triggers for Auto-refresh (Optional)
-- =====================================================

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_transaction_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Refresh concurrently to avoid locking
  REFRESH MATERIALIZED VIEW CONCURRENTLY transaction_analytics;
  RETURN NULL;
END;
$$;

-- Note: Triggers for auto-refresh are commented out by default as they can impact performance
-- Uncomment if you want automatic refresh (consider using CRON job instead)
/*
CREATE TRIGGER trigger_refresh_transaction_analytics
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_transaction_analytics();
*/

-- =====================================================
-- STEP 7: Verify Migration
-- =====================================================

DO $$ 
DECLARE
  v_view_exists BOOLEAN;
  v_index_count INTEGER;
BEGIN
  -- Check if enriched view was created
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'transactions_enriched'
  ) INTO v_view_exists;
  
  IF v_view_exists THEN
    RAISE NOTICE '✅ transactions_enriched view created successfully';
  ELSE
    RAISE WARNING '⚠️  transactions_enriched view was not created';
  END IF;
  
  -- Check indexes
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND tablename = 'provider_transactions'
  AND indexname LIKE 'idx_provider_transactions%';
  
  RAISE NOTICE '✅ Created % indexes on provider_transactions table', v_index_count;
  
  -- Check foreign key constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'provider_transactions'
    AND constraint_name = 'provider_transactions_transaction_id_fkey'
  ) THEN
    RAISE NOTICE '✅ Foreign key constraint added successfully';
  ELSE
    RAISE WARNING '⚠️  Foreign key constraint was not added';
  END IF;
  
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Migration 23 completed successfully';
  RAISE NOTICE '   - Enhanced provider_transactions with indexes';
  RAISE NOTICE '   - Created transactions_enriched view';
  RAISE NOTICE '   - Created transaction_analytics materialized view';
  RAISE NOTICE '   - Added helper functions';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;

