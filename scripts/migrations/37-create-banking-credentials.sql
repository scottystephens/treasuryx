-- 37-create-banking-credentials.sql
-- Secure storage for direct banking provider credentials

CREATE TABLE IF NOT EXISTS banking_provider_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES connections(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    credential_label TEXT NOT NULL,
    encrypted_credentials TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banking_provider_credentials_tenant_provider
    ON banking_provider_credentials (tenant_id, provider_id);

ALTER TABLE banking_provider_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their provider credentials" ON banking_provider_credentials;
CREATE POLICY "Users can view their provider credentials"
ON banking_provider_credentials FOR SELECT
USING (
    tenant_id IN (
        SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert provider credentials for their tenant" ON banking_provider_credentials;
CREATE POLICY "Users can insert provider credentials for their tenant"
ON banking_provider_credentials FOR INSERT
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can update provider credentials for their tenant" ON banking_provider_credentials;
CREATE POLICY "Users can update provider credentials for their tenant"
ON banking_provider_credentials FOR UPDATE
USING (
    tenant_id IN (
        SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete provider credentials for their tenant" ON banking_provider_credentials;
CREATE POLICY "Users can delete provider credentials for their tenant"
ON banking_provider_credentials FOR DELETE
USING (
    tenant_id IN (
        SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
);

