#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

async function fixAccountConnections() {
  console.log('🔧 Fixing Account Connections...\n');

  // Get all provider_accounts with linked accounts
  const { data: providerAccounts } = await supabase
    .from('provider_accounts')
    .select('id, connection_id, account_id, account_name, provider_id')
    .not('account_id', 'is', null);

  if (!providerAccounts || providerAccounts.length === 0) {
    console.log('No provider accounts with linked accounts found');
    return;
  }

  console.log(`Found ${providerAccounts.length} provider accounts with linked accounts\n`);

  let fixed = 0;
  let skipped = 0;

  for (const pa of providerAccounts) {
    console.log(`Processing: ${pa.account_name}`);

    // Check current account record
    const { data: account } = await supabase
      .from('accounts')
      .select('id, account_id, account_name, connection_id, provider_id')
      .eq('id', pa.account_id)
      .single();

    if (!account) {
      console.log(`   ❌ Account ${pa.account_id} not found\n`);
      continue;
    }

    if (account.connection_id) {
      console.log(`   ⏭️  Already has connection_id: ${account.connection_id}\n`);
      skipped++;
      continue;
    }

    // Update the account to add connection_id and provider_id
    const { error } = await supabase
      .from('accounts')
      .update({
        connection_id: pa.connection_id,
        provider_id: pa.provider_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pa.account_id);

    if (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    } else {
      console.log(`   ✅ Updated - connection_id: ${pa.connection_id}, provider: ${pa.provider_id}\n`);
      fixed++;
    }
  }

  console.log('═'.repeat(60));
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log('═'.repeat(60));
  console.log('\nRefresh the accounts page to see "Synced" badges!');
}

fixAccountConnections().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

