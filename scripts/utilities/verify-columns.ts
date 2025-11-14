import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyColumns() {
  console.log('🔍 Checking if columns exist in connections table...\n');
  
  // Test if columns exist by trying to query
  const { data, error } = await supabase
    .from('connections')
    .select('oauth_state, provider, external_connection_id')
    .limit(1);

  if (error) {
    console.log('❌ Columns not found or error:', error.message);
    process.exit(1);
  } else {
    console.log('✅ All columns exist! Query successful.');
    console.log('📊 Sample data:', data);
  }
}

verifyColumns();

