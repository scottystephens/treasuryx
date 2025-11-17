#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function runMigration21() {
  console.log('📊 Running Migration 21: Add Super Admin Support');
  console.log(`🔗 Database: ${supabaseUrl}\n`);

  const migrationFile = resolve(process.cwd(), 'scripts/migrations/21-add-super-admin-support.sql');
  const sql = readFileSync(migrationFile, 'utf-8');
  
  console.log('🔄 Executing migration SQL...\n');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }
    
    if (data && !data.success) {
      console.error('❌ Migration failed:', data.error);
      return;
    }
    
    console.log('✅ Migration 21 executed successfully!\n');
    
  } catch (err: any) {
    console.error('❌ Fatal error:', err.message);
  }
}

runMigration21().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

