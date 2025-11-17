-- =====================================================
-- Enhance Entities Table with RLS and Additional Fields
-- =====================================================

-- Add description and additional metadata fields if they don't exist
ALTER TABLE entities 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Enable RLS on entities table
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their tenant's entities" ON entities;
DROP POLICY IF EXISTS "Users can insert entities for their tenant" ON entities;
DROP POLICY IF EXISTS "Users can update their tenant's entities" ON entities;
DROP POLICY IF EXISTS "Users can delete their tenant's entities" ON entities;

-- CREATE RLS Policies for entities

-- SELECT: Users can view entities for their tenants
CREATE POLICY "Users can view their tenant's entities"
ON entities FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
  )
);

-- INSERT: Users with admin/owner role can create entities
CREATE POLICY "Users can insert entities for their tenant"
ON entities FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- UPDATE: Users with admin/owner role can update entities
CREATE POLICY "Users can update their tenant's entities"
ON entities FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- DELETE: Only owners can delete entities
CREATE POLICY "Users can delete their tenant's entities"
ON entities FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants 
    WHERE user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- Add updated_at trigger for entities
DROP TRIGGER IF EXISTS update_entities_updated_at ON entities;

CREATE OR REPLACE FUNCTION update_entities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW
  EXECUTE FUNCTION update_entities_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Entities table enhanced with RLS policies';
  RAISE NOTICE '📋 Entity policies:';
  RAISE NOTICE '   - SELECT: All users can view their tenant entities';
  RAISE NOTICE '   - INSERT/UPDATE: Admins and owners can create/edit';
  RAISE NOTICE '   - DELETE: Only owners can delete';
END $$;

