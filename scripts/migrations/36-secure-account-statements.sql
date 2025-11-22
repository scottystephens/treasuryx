-- Migration 36: Secure Account Statements
-- Enables RLS and adds policies for account_statements table (forgotten in Migration 28)

-- 1. Enable RLS
ALTER TABLE account_statements ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies

-- SELECT: Users can view statements for their tenant
CREATE POLICY "Users can view their tenant's statements"
ON account_statements FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
  )
);

-- INSERT: Users can insert statements for their tenant
CREATE POLICY "Users can insert statements for their tenant"
ON account_statements FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
  )
);

-- UPDATE: Users can update statements for their tenant
CREATE POLICY "Users can update their tenant's statements"
ON account_statements FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
  )
);

-- DELETE: Users can delete statements for their tenant
CREATE POLICY "Users can delete their tenant's statements"
ON account_statements FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
  )
);

DO $$
BEGIN
  RAISE NOTICE '✅ Account statements table secured with RLS policies';
END $$;

