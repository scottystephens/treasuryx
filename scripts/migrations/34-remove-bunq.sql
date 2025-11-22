-- Migration 34: Remove Bunq Provider
-- Removes Bunq integration tables and data as it is no longer supported

-- 1. Remove Bunq from banking_providers (cascades to provider_tokens, provider_accounts)
DELETE FROM banking_providers WHERE id = 'bunq';

-- 2. Cleanup legacy tables if they still exist
DROP TABLE IF EXISTS bunq_transactions_staging CASCADE;
DROP TABLE IF EXISTS bunq_accounts CASCADE;
DROP TABLE IF EXISTS bunq_oauth_tokens CASCADE;
DROP TABLE IF EXISTS bunq_tokens CASCADE; -- Older name

-- 3. Remove any lingering connections (should be cascaded but just in case)
DELETE FROM connections WHERE provider = 'bunq';

-- 4. Remove any ingestion jobs for Bunq
DELETE FROM ingestion_jobs WHERE job_type LIKE 'bunq_%';

DO $$
BEGIN
  RAISE NOTICE '✅ Bunq provider and related data removed successfully';
END $$;

