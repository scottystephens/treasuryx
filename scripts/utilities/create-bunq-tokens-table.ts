import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createBunqTokensTable() {
  console.log('📝 Creating bunq_oauth_tokens table...\n');

  const sql = `
-- Create Bunq OAuth Tokens Table
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
  bunq_user_type TEXT,
  bunq_environment TEXT DEFAULT 'production' CHECK (bunq_environment IN ('sandbox', 'production')),
  
  -- Metadata
  scopes TEXT[],
  authorized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Only one active token per connection
  UNIQUE (connection_id)
);

-- Enable RLS
ALTER TABLE bunq_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bunq_oauth_tokens_tenant ON bunq_oauth_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bunq_oauth_tokens_connection ON bunq_oauth_tokens(connection_id);
`;

  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`[${i + 1}/${statements.length}] Executing...`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ✅ Already exists (ok)\n`);
        } else {
          console.error(`  ❌ Error: ${error.message}\n`);
        }
      } else {
        console.log(`  ✅ Success\n`);
      }
    } catch (err) {
      console.error(`  ❌ Exception:`, err, '\n');
    }
  }

  console.log('═══════════════════════════════════════');
  console.log('✅ Migration complete!');
  console.log('═══════════════════════════════════════');
}

createBunqTokensTable();

