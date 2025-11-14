-- =====================================================
-- Enhance Accounts Table for Production Treasury Management
-- Industry-standard fields + 10 custom fields
-- =====================================================

-- Check if accounts table exists, if not create it
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Basic Information
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100),
  account_type VARCHAR(50) NOT NULL, -- 'checking', 'savings', 'money_market', 'credit_card', 'loan', 'investment', 'other'
  account_status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'closed', 'pending'
  
  -- Financial Institution
  bank_name VARCHAR(255),
  bank_identifier VARCHAR(100), -- SWIFT/BIC, Routing Number, etc.
  branch_name VARCHAR(255),
  branch_code VARCHAR(50),
  
  -- Account Details
  currency VARCHAR(3) DEFAULT 'USD',
  opening_date DATE,
  closing_date DATE,
  interest_rate DECIMAL(5,4), -- e.g., 0.0525 for 5.25%
  
  -- Balances (current state)
  current_balance DECIMAL(15,2) DEFAULT 0,
  available_balance DECIMAL(15,2),
  ledger_balance DECIMAL(15,2),
  
  -- Limits & Controls
  overdraft_limit DECIMAL(15,2),
  credit_limit DECIMAL(15,2),
  minimum_balance DECIMAL(15,2),
  
  -- Categorization
  business_unit VARCHAR(100),
  cost_center VARCHAR(100),
  gl_account_code VARCHAR(100), -- General Ledger code
  purpose TEXT, -- What this account is used for
  
  -- Contact & Authorization
  account_manager VARCHAR(255),
  authorized_signers TEXT[], -- Array of authorized people
  
  -- Integration
  external_account_id VARCHAR(255), -- ID from bank API
  plaid_account_id VARCHAR(255), -- If using Plaid
  sync_enabled BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  
  -- Custom Fields (up to 10)
  custom_fields JSONB DEFAULT '{}',
  -- Example structure:
  -- {
  --   "custom_1": { "label": "Project Code", "value": "PROJ-2025-001" },
  --   "custom_2": { "label": "Tax ID", "value": "12-3456789" },
  --   ...
  -- }
  
  -- Notes & Documentation
  notes TEXT,
  tags VARCHAR(50)[], -- Array of tags for categorization
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  
  -- Constraints
  CONSTRAINT valid_currency CHECK (char_length(currency) = 3)
);

-- Add tenant_id foreign key if tenants table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_tenant_id_fkey;
    ALTER TABLE public.accounts 
      ADD CONSTRAINT accounts_tenant_id_fkey 
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add created_by foreign key if auth.users exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_created_by_fkey;
    ALTER TABLE public.accounts 
      ADD CONSTRAINT accounts_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END $$;

-- =====================================================
-- Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON public.accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON public.accounts(tenant_id, account_status);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON public.accounts(tenant_id, account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_currency ON public.accounts(currency);
CREATE INDEX IF NOT EXISTS idx_accounts_external_id ON public.accounts(external_account_id) WHERE external_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_plaid_id ON public.accounts(plaid_account_id) WHERE plaid_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_sync ON public.accounts(sync_enabled, last_synced_at) WHERE sync_enabled = TRUE;

-- GIN index for custom_fields JSONB queries
CREATE INDEX IF NOT EXISTS idx_accounts_custom_fields ON public.accounts USING GIN (custom_fields);

-- GIN index for tags array
CREATE INDEX IF NOT EXISTS idx_accounts_tags ON public.accounts USING GIN (tags);

-- =====================================================
-- Row-Level Security (RLS) Policies
-- =====================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their tenant's accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can create accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete accounts" ON public.accounts;

-- Create new policies that work with user_tenants
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_tenants') THEN
    CREATE POLICY "Users can view their tenant's accounts" 
      ON public.accounts FOR SELECT 
      USING (
        EXISTS (
          SELECT 1 FROM public.user_tenants 
          WHERE user_tenants.tenant_id = accounts.tenant_id 
          AND user_tenants.user_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
      );

    CREATE POLICY "Users can create accounts" 
      ON public.accounts FOR INSERT 
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_tenants 
          WHERE user_tenants.tenant_id = accounts.tenant_id
          AND user_tenants.user_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
      );

    CREATE POLICY "Users can update accounts" 
      ON public.accounts FOR UPDATE 
      USING (
        EXISTS (
          SELECT 1 FROM public.user_tenants 
          WHERE user_tenants.tenant_id = accounts.tenant_id
          AND user_tenants.user_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
      );

    CREATE POLICY "Admins can delete accounts" 
      ON public.accounts FOR DELETE 
      USING (
        EXISTS (
          SELECT 1 FROM public.user_tenants 
          WHERE user_tenants.tenant_id = accounts.tenant_id
          AND user_tenants.user_id = auth.uid()
          AND user_tenants.role IN ('owner', 'admin')
        )
        OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
      );
  END IF;
END $$;

-- =====================================================
-- Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION update_account_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at 
  BEFORE UPDATE ON public.accounts 
  FOR EACH ROW EXECUTE FUNCTION update_account_updated_at();

-- =====================================================
-- Helper function to update account balance
-- =====================================================

CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
  v_balance DECIMAL(15,2);
BEGIN
  -- Calculate balance from transactions
  SELECT COALESCE(SUM(amount), 0)
  INTO v_balance
  FROM public.transactions
  WHERE account_id = p_account_id;
  
  -- Update account
  UPDATE public.accounts
  SET current_balance = v_balance,
      updated_at = NOW()
  WHERE id = p_account_id;
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Success Message
-- =====================================================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Accounts Table Enhanced Successfully!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Features added:';
  RAISE NOTICE '  ✓ Industry-standard account fields';
  RAISE NOTICE '  ✓ 10 custom fields (JSONB)';
  RAISE NOTICE '  ✓ Balance tracking';
  RAISE NOTICE '  ✓ Integration fields (Plaid, external IDs)';
  RAISE NOTICE '  ✓ Authorization tracking';
  RAISE NOTICE '  ✓ RLS policies';
  RAISE NOTICE '  ✓ Performance indexes';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper functions:';
  RAISE NOTICE '  ✓ recalculate_account_balance(account_id)';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

