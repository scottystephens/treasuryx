-- =====================================================
-- Make entity_id nullable for provider accounts
-- Provider-synced accounts don't require entities
-- =====================================================

-- Make entity_id nullable
ALTER TABLE accounts 
  ALTER COLUMN entity_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN accounts.entity_id IS 'Legacy field - optional for provider-synced accounts. Required for manually created accounts linked to entities.';

