#!/usr/bin/env tsx

import { supabase } from '../../lib/supabase';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

async function checkAccounts() {
  console.log('🔍 Checking accounts table for Plaid/Tink bank names...\n');
  
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('account_name, bank_name, provider_id, connection_id, external_account_id, custom_fields, created_at')
    .in('provider_id', ['plaid', 'tink'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${accounts?.length || 0} Plaid/Tink accounts:\n`);
  console.log('Account Name          | Bank Name      | Provider | Institution Name (custom_fields)');
  console.log('----------------------|----------------|----------|----------------------------------');
  
  for (const acc of accounts || []) {
    const institutionName = acc.custom_fields?.institution_name || 'N/A';
    const institutionId = acc.custom_fields?.institution_id || 'N/A';
    
    console.log(
      `${(acc.account_name || 'N/A').substring(0, 21).padEnd(21)} | ` +
      `${(acc.bank_name || 'N/A').padEnd(14)} | ` +
      `${(acc.provider_id || 'N/A').padEnd(8)} | ` +
      `${institutionName} (${institutionId})`
    );
  }
  
  console.log('\n📊 Summary:');
  const plaidCount = accounts?.filter(a => a.provider_id === 'plaid').length || 0;
  const tinkCount = accounts?.filter(a => a.provider_id === 'tink').length || 0;
  const withInstitution = accounts?.filter(a => a.custom_fields?.institution_name).length || 0;
  
  console.log(`  - Plaid accounts: ${plaidCount}`);
  console.log(`  - Tink accounts: ${tinkCount}`);
  console.log(`  - With institution data: ${withInstitution}/${accounts?.length || 0}`);
  
  if (withInstitution === 0) {
    console.log('\n⚠️  No accounts have institution data yet.');
    console.log('💡 This is expected - these accounts were synced with the OLD code.');
    console.log('\n✅ To get real bank names:');
    console.log('   1. Go to http://localhost:3001/connections');
    console.log('   2. Click "Sync" on each Plaid/Tink connection');
    console.log('   3. The bank names will update to the actual institutions!\n');
  } else {
    console.log(`\n✅ ${withInstitution} accounts already have institution data!`);
  }
  
  // Show connection info
  console.log('\n🔗 Checking connections...');
  const connectionIds = [...new Set(accounts?.map(a => a.connection_id).filter(Boolean))];
  
  for (const connId of connectionIds) {
    const { data: conn } = await supabase
      .from('connections')
      .select('name, provider, status')
      .eq('id', connId)
      .single();
    
    if (conn) {
      const accountCount = accounts?.filter(a => a.connection_id === connId).length || 0;
      console.log(`  - ${conn.name} (${conn.provider}): ${accountCount} accounts, status: ${conn.status}`);
    }
  }
}

checkAccounts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

