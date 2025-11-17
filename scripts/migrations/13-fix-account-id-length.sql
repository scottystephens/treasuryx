-- =====================================================
-- Migration 13: Fix account_id length for UUIDs
-- Problem: account_id field may have varchar(34) constraint
-- but UUIDs are 36 characters (with dashes)
-- =====================================================

-- Check current type and fix if needed
DO $$ 
DECLARE
  account_id_type text;
  account_id_length integer;
BEGIN
  -- Get current account_id column type
  SELECT data_type, character_maximum_length
  INTO account_id_type, account_id_length
  FROM information_schema.columns
  WHERE table_name = 'accounts' 
    AND column_name = 'account_id';
  
  RAISE NOTICE 'Current account_id type: %, length: %', account_id_type, account_id_length;
  
  -- If it's character varying with length < 36, extend it or change to TEXT
  IF account_id_type = 'character varying' AND (account_id_length IS NOT NULL AND account_id_length < 36) THEN
    RAISE NOTICE 'Extending account_id to TEXT to accommodate UUIDs (36 chars)';
    ALTER TABLE accounts ALTER COLUMN account_id TYPE TEXT;
  ELSIF account_id_type = 'character varying' AND account_id_length IS NULL THEN
    -- Already unlimited varchar, ensure it's TEXT for consistency
    ALTER TABLE accounts ALTER COLUMN account_id TYPE TEXT;
    RAISE NOTICE 'Changed account_id to TEXT';
  ELSIF account_id_type = 'text' THEN
    RAISE NOTICE 'account_id is already TEXT (unlimited), no change needed';
  ELSE
    RAISE NOTICE 'account_id type is %, no change needed', account_id_type;
  END IF;
  
  -- Also ensure external_account_id can hold provider IDs (32+ chars)
  SELECT character_maximum_length
  INTO account_id_length
  FROM information_schema.columns
  WHERE table_name = 'accounts' 
    AND column_name = 'external_account_id';
  
  IF account_id_length IS NOT NULL AND account_id_length < 40 THEN
    RAISE NOTICE 'Extending external_account_id to accommodate provider IDs';
    ALTER TABLE accounts ALTER COLUMN external_account_id TYPE TEXT;
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN accounts.account_id IS 'Primary key - can be UUID (36 chars) or custom format';
COMMENT ON COLUMN accounts.external_account_id IS 'Provider-specific account ID - varies by provider';

