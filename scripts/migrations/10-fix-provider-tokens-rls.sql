-- Fix provider_tokens RLS policy to allow INSERT/UPDATE with WITH CHECK
-- Current policy only has USING clause which doesn't work for INSERT/UPDATE

-- Drop the existing policy
DROP POLICY IF EXISTS "Editors can manage provider tokens" ON provider_tokens;

-- Recreate with both USING and WITH CHECK
CREATE POLICY "Editors can manage provider tokens"
ON provider_tokens FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  )
);

-- Verify RLS is enabled
ALTER TABLE provider_tokens ENABLE ROW LEVEL SECURITY;

