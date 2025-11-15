/**
 * Check what the actual primary key column is for the accounts table
 */

import { supabase } from '../../lib/supabase';

async function checkPrimaryKey() {
  console.log('🔍 Checking accounts table primary key...\n');

  try {
    // Try to get any account to see the column structure
    const { data: account, error } = await supabase
      .from('accounts')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error querying accounts:', error);
      return;
    }

    if (!account) {
      console.log('⚠️  No accounts found in database');
      console.log('   Creating a test query to check schema...\n');
    } else {
      console.log('✅ Found account, checking columns:');
      console.log(Object.keys(account));
      console.log('\n');
    }

    // Check if 'id' column exists
    const { error: idError } = await supabase
      .from('accounts')
      .select('id')
      .limit(1);

    if (!idError) {
      console.log('✅ Column "id" exists');
    } else {
      console.log('❌ Column "id" does not exist');
      console.log('   Error:', idError.message);
    }

    // Check if 'account_id' column exists
    const { error: accountIdError } = await supabase
      .from('accounts')
      .select('account_id')
      .limit(1);

    if (!accountIdError) {
      console.log('✅ Column "account_id" exists');
    } else {
      console.log('❌ Column "account_id" does not exist');
      console.log('   Error:', accountIdError.message);
    }

    console.log('\n📋 Recommendation:');
    if (!idError && accountIdError) {
      console.log('   Primary key is: id (UUID)');
      console.log('   Migration 11 is correct as-is');
    } else if (idError && !accountIdError) {
      console.log('   Primary key is: account_id (TEXT)');
      console.log('   Migration 11 needs to be updated to use account_id');
    } else if (!idError && !accountIdError) {
      console.log('   Both columns exist - need to determine which is primary key');
    } else {
      console.log('   Cannot determine schema - table may not exist');
    }

  } catch (error) {
    console.error('❌ Failed to check schema:', error);
  }
}

checkPrimaryKey()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });

