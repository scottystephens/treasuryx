#!/usr/bin/env npx tsx
/**
 * Fix Missing Accounts
 * Creates accounts in the accounts table for provider_accounts that don't have linked accounts
 */

import { supabase } from '../../lib/supabase';

async function fixMissingAccounts() {
  console.log('🔧 Fixing missing accounts for provider_accounts...\n');

  // Find provider_accounts without linked accounts
  const { data: providerAccounts, error: paError } = await supabase
    .from('provider_accounts')
    .select('*')
    .is('account_id', null);

  if (paError) {
    console.error('❌ Error fetching provider_accounts:', paError.message);
    return;
  }

  if (!providerAccounts || providerAccounts.length === 0) {
    console.log('✅ All provider_accounts are already linked to accounts');
    return;
  }

  console.log(`Found ${providerAccounts.length} provider_accounts without linked accounts\n`);

  // Get connection details
  const connectionIds = [...new Set(providerAccounts.map(pa => pa.connection_id))];
  const { data: connections, error: connError } = await supabase
    .from('connections')
    .select('id, provider, tenant_id')
    .in('id', connectionIds);

  if (connError) {
    console.error('❌ Error fetching connections:', connError.message);
    return;
  }

  const connectionMap = new Map(connections?.map(c => [c.id, c]) || []);

  let created = 0;
  let failed = 0;

  for (const providerAccount of providerAccounts) {
    const connection = connectionMap.get(providerAccount.connection_id);
    if (!connection) {
      console.log(`⚠️  Skipping ${providerAccount.account_name}: connection not found`);
      failed++;
      continue;
    }

    try {
      // Generate account_id
      const accountId = crypto.randomUUID();

      // Create account
      const newAccount: any = {
        account_id: accountId,
        tenant_id: providerAccount.tenant_id,
        connection_id: providerAccount.connection_id,
        provider_id: providerAccount.provider_id,
        account_name: providerAccount.account_name,
        account_number: providerAccount.account_number || providerAccount.external_account_id,
        account_type: providerAccount.account_type || 'checking',
        account_status: providerAccount.status || 'active',
        currency: providerAccount.currency || 'USD',
        current_balance: providerAccount.balance || 0,
        external_account_id: providerAccount.external_account_id,
        iban: providerAccount.iban,
        bic: providerAccount.bic,
        bank_name: connection.provider?.charAt(0).toUpperCase() + connection.provider?.slice(1) || 'Bank',
        sync_enabled: true,
        last_synced_at: providerAccount.last_synced_at || new Date().toISOString(),
        custom_fields: {
          provider_metadata: providerAccount.provider_metadata || {},
          created_via_provider: providerAccount.provider_id,
          first_sync_at: providerAccount.created_at,
        },
        entity_id: null, // Legacy field - provider accounts don't require entities
      };

      const { data: createdAccount, error: createError } = await supabase
        .from('accounts')
        .insert(newAccount)
        .select()
        .single();

      if (createError) {
        console.error(`❌ Failed to create account for ${providerAccount.account_name}:`, createError.message);
        failed++;
        continue;
      }

      // Link provider_account to the new account
      const { error: linkError } = await supabase
        .from('provider_accounts')
        .update({ account_id: createdAccount.id })
        .eq('id', providerAccount.id);

      if (linkError) {
        console.error(`❌ Failed to link provider_account for ${providerAccount.account_name}:`, linkError.message);
        failed++;
        continue;
      }

      console.log(`✅ Created and linked account: ${providerAccount.account_name} (${createdAccount.account_id})`);
      created++;
    } catch (error) {
      console.error(`❌ Error processing ${providerAccount.account_name}:`, error);
      failed++;
    }
  }

  console.log(`\n✅ Complete! Created ${created} accounts, ${failed} failed`);
}

fixMissingAccounts().catch(console.error);

