-- Migration 35: Fix Tink transaction relationship
-- Adds foreign key between tink_transactions and tink_accounts to allow joins

-- Add composite foreign key to allow joining transactions to accounts
-- This is required for PostgREST to detect the relationship
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_tink_transactions_account'
  ) THEN
    ALTER TABLE tink_transactions
    ADD CONSTRAINT fk_tink_transactions_account
    FOREIGN KEY (connection_id, account_id) 
    REFERENCES tink_accounts (connection_id, account_id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Also ensure the composite unique key exists on tink_accounts (it should from migration 31)
-- Just in case, we ensure there's a unique constraint we can reference
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE table_name = 'tink_accounts' 
    AND constraint_type = 'UNIQUE'
    AND constraint_name = 'tink_accounts_connection_id_account_id_key'
  ) THEN
    ALTER TABLE tink_accounts
    ADD CONSTRAINT tink_accounts_connection_id_account_id_key
    UNIQUE (connection_id, account_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if it already exists with a different name
  RAISE NOTICE 'Unique constraint likely already exists';
END $$;

