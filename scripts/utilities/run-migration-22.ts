#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkExecSql() {
  // Check if exec_sql function exists
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: 'SELECT 1 as test' 
  });
  
  if (error) {
    console.log('⚠️  exec_sql function not found. Creating it first...\n');
    // Create exec_sql function
    const execSqlFunction = readFileSync(
      resolve(process.cwd(), 'scripts/migrations/09-create-exec-sql-function.sql'),
      'utf-8'
    );
    
    // Execute via direct SQL (if possible) or we'll need to use a different method
    // For now, let's try using the REST API directly
    console.log('📝 Please run migration 09-create-exec-sql-function.sql first in Supabase SQL Editor');
    console.log('   Or the exec_sql function needs to be created manually.\n');
    return false;
  }
  
  console.log('✅ exec_sql function exists\n');
  return true;
}

async function runMigration22() {
  console.log('📊 Running Migration 22: Add Orchestration Tables');
  console.log(`🔗 Database: ${supabaseUrl}\n`);

  // Check if exec_sql exists
  const hasExecSql = await checkExecSql();
  if (!hasExecSql) {
    console.log('❌ Cannot proceed without exec_sql function.');
    console.log('   Please run migration 09-create-exec-sql-function.sql first.');
    return;
  }

  const migrationFile = resolve(process.cwd(), 'scripts/migrations/22-add-orchestration-tables.sql');
  const sql = readFileSync(migrationFile, 'utf-8');
  
  console.log('📝 Executing migration file...\n');
  
  // For complex migrations with functions and DO blocks, we need to execute
  // the entire SQL as one statement, not split by semicolons
  // However, exec_sql might have limitations, so let's try executing it in chunks
  
  // Split by major sections (looking for CREATE OR REPLACE, ALTER TABLE, etc.)
  // But actually, let's try executing the whole thing first
  try {
    console.log('🔄 Executing migration SQL...');
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ Error executing migration:', error.message);
      console.error('\n⚠️  Migration failed. You may need to run this in Supabase SQL Editor:');
      console.error('   https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/sql/new');
      console.error('\n   Copy and paste the contents of:');
      console.error(`   ${migrationFile}`);
      return;
    }
    
    console.log('✅ Migration executed successfully!');
    console.log('   Result:', data);
    
  } catch (err: any) {
    console.error('❌ Fatal error:', err.message);
    console.error('\n⚠️  Please run this migration manually in Supabase SQL Editor:');
    console.error('   https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/sql/new');
  }
}

runMigration22().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

