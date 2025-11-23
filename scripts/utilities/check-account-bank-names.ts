#!/usr/bin/env tsx

/**
 * Check what bank_name is stored for synced accounts
 * This will help us see if we need to fetch institution names from Plaid/Tink
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

import { supabase } from '../../lib/supabase';
import { plaidClient } from '../../lib/plaid';

async function checkAccountBankNames() {
  console.log('🔍 Checking account bank names...\n');

  // Get all synced accounts (those with connection_id)
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select(`
      account_id,
      account_name,
      bank_name,
      provider_id,
      connection_id,
      external_account_id,
      connections:connection_id (
        provider,
        name
      )
    `)
    .not('connection_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error fetching accounts:', error);
    return;
  }

  console.log(`Found ${accounts?.length || 0} synced accounts:\n`);
  console.log('Account Name                | Bank Name        | Provider | External ID');
  console.log('--------------------------- | ---------------- | -------- | -----------');

  for (const account of accounts || []) {
    const conn = Array.isArray(account.connections) ? account.connections[0] : account.connections;
    console.log(
      `${account.account_name?.padEnd(27) || 'N/A'} | ` +
      `${(account.bank_name || 'N/A').padEnd(16)} | ` +
      `${(conn?.provider || 'N/A').padEnd(8)} | ` +
      `${account.external_account_id || 'N/A'}`
    );
  }

  // Check Plaid raw data
  console.log('\n\n📦 Checking Plaid raw account data...\n');
  const { data: plaidAccounts, error: plaidError } = await supabase
    .from('plaid_accounts')
    .select('account_id, name, item_id, raw_data')
    .limit(5);

  if (plaidError) {
    console.error('❌ Error fetching Plaid accounts:', plaidError);
  } else {
    console.log(`Found ${plaidAccounts?.length || 0} Plaid accounts in raw storage`);
    
    for (const acc of plaidAccounts || []) {
      console.log(`\nAccount: ${acc.name}`);
      console.log(`Item ID: ${acc.item_id}`);
      console.log(`Has raw_data: ${!!acc.raw_data}`);
      
      // Check if we can get institution from item
      if (acc.item_id) {
        console.log(`\n🔍 Checking if we can fetch institution for item ${acc.item_id}...`);
        
        // Get access token for this item
        const { data: token } = await supabase
          .from('provider_tokens')
          .select('access_token')
          .eq('provider_id', 'plaid')
          .limit(1)
          .single();

        if (token?.access_token) {
          try {
            const itemResponse = await plaidClient.itemGet({
              access_token: token.access_token,
            });

            const institutionId = itemResponse.data.item.institution_id;
            console.log(`✅ Institution ID: ${institutionId}`);

            if (institutionId) {
              // Fetch institution details
              const instResponse = await plaidClient.institutionsGetById({
                institution_id: institutionId,
                country_codes: ['US'] as any,
              });

              console.log(`✅ Bank Name: ${instResponse.data.institution.name}`);
              console.log(`   Logo: ${instResponse.data.institution.logo || 'N/A'}`);
              console.log(`   URL: ${instResponse.data.institution.url || 'N/A'}`);
            }
          } catch (err: any) {
            console.log(`⚠️  Could not fetch institution: ${err.message}`);
          }
        }
        break; // Just check first one
      }
    }
  }

  // Check Tink raw data
  console.log('\n\n📦 Checking Tink raw account data...\n');
  const { data: tinkAccounts, error: tinkError } = await supabase
    .from('tink_accounts')
    .select('account_id, name, financial_institution_id, raw_data')
    .limit(3);

  if (tinkError) {
    console.error('❌ Error fetching Tink accounts:', tinkError);
  } else {
    console.log(`Found ${tinkAccounts?.length || 0} Tink accounts in raw storage\n`);
    
    for (const acc of tinkAccounts || []) {
      console.log(`Account: ${acc.name}`);
      console.log(`Financial Institution ID: ${acc.financial_institution_id || 'N/A'}`);
      console.log(`Has raw_data: ${!!acc.raw_data}`);
      console.log('');
    }
  }

  console.log('\n✅ Analysis complete!');
  console.log('\n💡 Next Steps:');
  console.log('   1. For Plaid: Fetch institution name using item.institution_id → institutionsGetById()');
  console.log('   2. For Tink: Fetch provider name using financial_institution_id');
  console.log('   3. Update account-service.ts to set bank_name from institution data');
}

checkAccountBankNames()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

