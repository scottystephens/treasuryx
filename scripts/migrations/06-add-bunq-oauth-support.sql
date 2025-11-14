-- =====================================================
-- Stratifi - Bunq OAuth Integration Support
-- This migration adds support for storing Bunq OAuth tokens
-- and connection metadata for the banking API integration
-- =====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- STEP 1: Create Bunq OAuth Tokens Table
-- =====================================================

CREATE TABLE IF NOT EXISTS bunq_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  
  -- OAuth tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Bunq-specific data
  bunq_user_id TEXT,
  bunq_user_type TEXT, -- UserPerson or UserCompany
  bunq_api_key TEXT, -- For API key authentication (alternative to OAuth)
  bunq_environment TEXT DEFAULT 'production' CHECK (bunq_environment IN ('sandbox', 'production')),
  
  -- API endpoints and metadata
  bunq_session_token TEXT,
  bunq_installation_token TEXT,
  bunq_server_public_key TEXT,
  
  -- Metadata
  scopes TEXT[], -- OAuth scopes granted
  authorized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure only one active token per connection
  UNIQUE (connection_id)
);

-- =====================================================
-- STEP 2: Create Bunq Accounts Mapping Table
-- =====================================================

CREATE TABLE IF NOT EXISTS bunq_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  
  -- Bunq account data
  bunq_monetary_account_id TEXT NOT NULL,
  bunq_account_type TEXT, -- MonetaryAccountBank, MonetaryAccountJoint, etc.
  description TEXT,
  currency TEXT,
  balance DECIMAL(19, 4),
  
  -- IBAN and details
  iban TEXT,
  bic TEXT,
  display_name TEXT,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
  
  -- Sync metadata
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate account mappings
  UNIQUE (connection_id, bunq_monetary_account_id)
);

-- =====================================================
-- STEP 3: Create Bunq Transactions Staging Table
-- =====================================================

CREATE TABLE IF NOT EXISTS bunq_transactions_staging (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  bunq_account_id UUID REFERENCES bunq_accounts(id) ON DELETE CASCADE,
  
  -- Bunq transaction data
  bunq_payment_id TEXT NOT NULL,
  bunq_monetary_account_id TEXT NOT NULL,
  
  -- Transaction details
  amount DECIMAL(19, 4) NOT NULL,
  currency TEXT NOT NULL,
  description TEXT,
  transaction_type TEXT, -- 'IDEAL', 'BUNQ', 'MASTERCARD', etc.
  
  -- Counterparty
  counterparty_name TEXT,
  counterparty_iban TEXT,
  counterparty_account_number TEXT,
  
  -- Dates
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_timestamp TIMESTAMP WITH TIME ZONE,
  
  -- Import status
  imported_to_transactions BOOLEAN DEFAULT false,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  import_job_id UUID,
  
  -- Raw data for debugging
  raw_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate imports
  UNIQUE (connection_id, bunq_payment_id)
);

-- =====================================================
-- STEP 4: Update Connections Table for Bunq
-- =====================================================

-- Add columns to connections table if they don't exist
DO $$ 
BEGIN
  -- Add provider column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'connections' AND column_name = 'provider'
  ) THEN
    ALTER TABLE connections ADD COLUMN provider TEXT;
  END IF;
  
  -- Add external_connection_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'connections' AND column_name = 'external_connection_id'
  ) THEN
    ALTER TABLE connections ADD COLUMN external_connection_id TEXT;
  END IF;
  
  -- Add oauth_state column for security
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'connections' AND column_name = 'oauth_state'
  ) THEN
    ALTER TABLE connections ADD COLUMN oauth_state TEXT;
  END IF;
  
  -- Add last_error column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'connections' AND column_name = 'last_error'
  ) THEN
    ALTER TABLE connections ADD COLUMN last_error TEXT;
  END IF;
END $$;

-- =====================================================
-- STEP 5: Create Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_bunq_oauth_tokens_tenant ON bunq_oauth_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bunq_oauth_tokens_connection ON bunq_oauth_tokens(connection_id);
CREATE INDEX IF NOT EXISTS idx_bunq_oauth_tokens_expires ON bunq_oauth_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_bunq_accounts_tenant ON bunq_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bunq_accounts_connection ON bunq_accounts(connection_id);
CREATE INDEX IF NOT EXISTS idx_bunq_accounts_account ON bunq_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_bunq_accounts_monetary ON bunq_accounts(bunq_monetary_account_id);

CREATE INDEX IF NOT EXISTS idx_bunq_transactions_staging_tenant ON bunq_transactions_staging(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bunq_transactions_staging_connection ON bunq_transactions_staging(connection_id);
CREATE INDEX IF NOT EXISTS idx_bunq_transactions_staging_date ON bunq_transactions_staging(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bunq_transactions_staging_imported ON bunq_transactions_staging(imported_to_transactions);

CREATE INDEX IF NOT EXISTS idx_connections_provider ON connections(provider);
CREATE INDEX IF NOT EXISTS idx_connections_external_id ON connections(external_connection_id);

-- =====================================================
-- STEP 6: Row-Level Security (RLS) Policies
-- =====================================================

ALTER TABLE bunq_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE bunq_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bunq_transactions_staging ENABLE ROW LEVEL SECURITY;

-- Bunq OAuth Tokens: Only users with access to the tenant can view
CREATE POLICY "Users can view their tenant's bunq tokens"
ON bunq_oauth_tokens FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Editors can manage bunq tokens"
ON bunq_oauth_tokens FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  )
);

-- Bunq Accounts
CREATE POLICY "Users can view their tenant's bunq accounts"
ON bunq_accounts FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Editors can manage bunq accounts"
ON bunq_accounts FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  )
);

-- Bunq Transactions Staging
CREATE POLICY "Users can view their tenant's bunq transactions"
ON bunq_transactions_staging FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Editors can manage bunq transactions"
ON bunq_transactions_staging FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  )
);

-- =====================================================
-- STEP 7: Helper Functions
-- =====================================================

-- Function to refresh expired Bunq OAuth tokens
CREATE OR REPLACE FUNCTION refresh_bunq_oauth_token(p_connection_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Get the token record
  SELECT * INTO v_token_record
  FROM bunq_oauth_tokens
  WHERE connection_id = p_connection_id
    AND revoked_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if token is expired or about to expire (within 5 minutes)
  IF v_token_record.expires_at IS NULL 
     OR v_token_record.expires_at > NOW() + INTERVAL '5 minutes' THEN
    RETURN TRUE; -- Token is still valid
  END IF;
  
  -- Token needs refresh - this will be handled by the application
  -- Just return FALSE to signal refresh is needed
  RETURN FALSE;
END;
$$;

-- Function to import Bunq transactions to main transactions table
CREATE OR REPLACE FUNCTION import_bunq_transactions_to_main(
  p_connection_id UUID,
  p_job_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_staging_record RECORD;
  v_tenant_id UUID;
  v_account_id UUID;
BEGIN
  -- Get tenant_id from connection
  SELECT tenant_id INTO v_tenant_id
  FROM connections
  WHERE id = p_connection_id;
  
  -- Import transactions from staging
  FOR v_staging_record IN
    SELECT 
      st.*,
      ba.account_id
    FROM bunq_transactions_staging st
    LEFT JOIN bunq_accounts ba ON st.bunq_account_id = ba.id
    WHERE st.connection_id = p_connection_id
      AND st.imported_to_transactions = FALSE
      AND st.import_job_id = p_job_id
  LOOP
    -- Insert into main transactions table
    INSERT INTO transactions (
      tenant_id,
      account_id,
      transaction_date,
      amount,
      currency,
      description,
      transaction_type,
      connection_id,
      external_transaction_id,
      source_type,
      import_job_id,
      metadata
    )
    VALUES (
      v_tenant_id,
      v_staging_record.account_id,
      v_staging_record.transaction_date,
      v_staging_record.amount,
      v_staging_record.currency,
      v_staging_record.description,
      v_staging_record.transaction_type,
      p_connection_id,
      v_staging_record.bunq_payment_id,
      'bunq_api',
      p_job_id,
      jsonb_build_object(
        'counterparty_name', v_staging_record.counterparty_name,
        'counterparty_iban', v_staging_record.counterparty_iban,
        'bunq_payment_id', v_staging_record.bunq_payment_id
      )
    )
    ON CONFLICT (tenant_id, connection_id, external_transaction_id) 
    DO UPDATE SET
      amount = EXCLUDED.amount,
      description = EXCLUDED.description,
      updated_at = NOW()
    RETURNING id INTO v_account_id;
    
    -- Mark as imported
    UPDATE bunq_transactions_staging
    SET 
      imported_to_transactions = TRUE,
      transaction_id = v_account_id
    WHERE id = v_staging_record.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- =====================================================
-- STEP 8: Comments for Documentation
-- =====================================================

COMMENT ON TABLE bunq_oauth_tokens IS 'OAuth tokens and API keys for Bunq banking API integration';
COMMENT ON TABLE bunq_accounts IS 'Mapping between Bunq monetary accounts and Stratifi accounts';
COMMENT ON TABLE bunq_transactions_staging IS 'Staging table for Bunq transactions before import';

COMMENT ON COLUMN bunq_oauth_tokens.access_token IS 'OAuth access token for Bunq API';
COMMENT ON COLUMN bunq_oauth_tokens.refresh_token IS 'OAuth refresh token to renew access';
COMMENT ON COLUMN bunq_oauth_tokens.bunq_environment IS 'sandbox for testing, production for live data';
COMMENT ON COLUMN bunq_accounts.bunq_monetary_account_id IS 'Bunq internal account ID';
COMMENT ON COLUMN bunq_transactions_staging.imported_to_transactions IS 'Flag to track if transaction was imported to main table';

-- =====================================================
-- Success Message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Bunq OAuth integration setup complete!';
  RAISE NOTICE '📋 Tables created:';
  RAISE NOTICE '   - bunq_oauth_tokens';
  RAISE NOTICE '   - bunq_accounts';
  RAISE NOTICE '   - bunq_transactions_staging';
  RAISE NOTICE '🔒 RLS policies enabled for all tables';
  RAISE NOTICE '🚀 Ready to integrate Bunq banking API';
END $$;

