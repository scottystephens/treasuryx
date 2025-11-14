import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testExecSql() {
  console.log('🧪 Testing exec_sql function...\n');

  // Test 1: Simple SELECT query
  console.log('Test 1: SELECT NOW()');
  const { data: test1, error: error1 } = await supabase.rpc('exec_sql', {
    sql: 'SELECT NOW()'
  });
  
  if (error1) {
    console.log('❌ Test 1 failed:', error1.message);
    if (error1.message.includes('Could not find the function')) {
      console.log('\n⚠️  The exec_sql function does not exist yet!');
      console.log('📝 Run this migration first:');
      console.log('   scripts/migrations/09-create-exec-sql-function.sql');
      console.log('\n🔗 In Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/sql/new');
      process.exit(1);
    }
  } else {
    console.log('✅ Test 1 passed:', test1);
  }

  // Test 2: Create a test table
  console.log('\nTest 2: CREATE TABLE IF NOT EXISTS');
  const { data: test2, error: error2 } = await supabase.rpc('exec_sql', {
    sql: 'CREATE TABLE IF NOT EXISTS test_exec_sql (id SERIAL PRIMARY KEY, created_at TIMESTAMP DEFAULT NOW())'
  });
  
  if (error2) {
    console.log('❌ Test 2 failed:', error2.message);
  } else {
    console.log('✅ Test 2 passed:', test2);
  }

  // Test 3: Insert data
  console.log('\nTest 3: INSERT INTO');
  const { data: test3, error: error3 } = await supabase.rpc('exec_sql', {
    sql: 'INSERT INTO test_exec_sql DEFAULT VALUES'
  });
  
  if (error3) {
    console.log('❌ Test 3 failed:', error3.message);
  } else {
    console.log('✅ Test 3 passed:', test3);
  }

  // Test 4: Alter table (add column)
  console.log('\nTest 4: ALTER TABLE ADD COLUMN');
  const { data: test4, error: error4 } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE test_exec_sql ADD COLUMN IF NOT EXISTS test_column TEXT'
  });
  
  if (error4) {
    console.log('❌ Test 4 failed:', error4.message);
  } else {
    console.log('✅ Test 4 passed:', test4);
  }

  // Test 5: Error handling (intentional syntax error)
  console.log('\nTest 5: Error handling (syntax error)');
  const { data: test5, error: error5 } = await supabase.rpc('exec_sql', {
    sql: 'SELECT * FROM nonexistent_table_xyz'
  });
  
  if (error5) {
    console.log('✅ Test 5 passed - Error caught:', error5.message);
  } else if (test5 && !test5.success) {
    console.log('✅ Test 5 passed - Function returned error:', test5);
  } else {
    console.log('❌ Test 5 failed - Should have returned an error');
  }

  // Cleanup
  console.log('\nTest 6: Cleanup - DROP TABLE');
  const { data: test6, error: error6 } = await supabase.rpc('exec_sql', {
    sql: 'DROP TABLE IF EXISTS test_exec_sql'
  });
  
  if (error6) {
    console.log('❌ Test 6 failed:', error6.message);
  } else {
    console.log('✅ Test 6 passed:', test6);
  }

  console.log('\n═══════════════════════════════════════');
  console.log('✅ All exec_sql tests completed!');
  console.log('═══════════════════════════════════════');
}

testExecSql().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});

