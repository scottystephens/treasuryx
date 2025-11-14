// Generic Banking Provider Sync
// Syncs accounts and transactions for any banking provider

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getProvider } from '@/lib/banking-providers/provider-registry';
import {
  supabase,
  updateConnection,
  createIngestionJob,
  updateIngestionJob,
  createAccount,
} from '@/lib/supabase';

export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const providerId = params.provider;

    // Get user from server-side client
    const supabaseClient = await createClient();
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the banking provider
    const provider = getProvider(providerId);

    // Parse request body
    const body = await req.json();
    const {
      connectionId,
      tenantId,
      syncAccounts = true,
      syncTransactions = true,
      transactionLimit = 200,
    } = body;

    if (!connectionId || !tenantId) {
      return NextResponse.json(
        { error: 'Connection ID and Tenant ID are required' },
        { status: 400 }
      );
    }

    // Get connection
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('*')
      .eq('id', connectionId)
      .eq('tenant_id', tenantId)
      .eq('provider', providerId)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Create ingestion job
    const ingestionJob = await createIngestionJob({
      tenant_id: tenantId,
      connection_id: connectionId,
      job_type: `${providerId}_sync`,
      status: 'running',
    });

    try {
      // Get provider tokens
      const { data: tokenData, error: tokenError } = await supabase
        .from('provider_tokens')
        .select('*')
        .eq('connection_id', connectionId)
        .eq('provider_id', providerId)
        .eq('status', 'active')
        .single();

      if (tokenError || !tokenData) {
        throw new Error('OAuth token not found. Please reconnect your account.');
      }

      // Check if token needs refresh
      const tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || undefined,
        expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at) : undefined,
        tokenType: tokenData.token_type || 'Bearer',
        scope: tokenData.scopes,
      };

      if (tokens.expiresAt && provider.isTokenExpired(tokens.expiresAt)) {
        if (!tokens.refreshToken) {
          throw new Error('Access token expired and no refresh token available.');
        }

        const newTokens = await provider.refreshAccessToken(tokens.refreshToken);

        // Update stored token
        await supabase
          .from('provider_tokens')
          .update({
            access_token: newTokens.accessToken,
            refresh_token: newTokens.refreshToken || tokenData.refresh_token,
            expires_at: newTokens.expiresAt?.toISOString() || null,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', tokenData.id);

        tokens.accessToken = newTokens.accessToken;
        tokens.expiresAt = newTokens.expiresAt;
      }

      const credentials = {
        connectionId,
        tenantId,
        tokens,
        metadata: tokenData.provider_metadata,
      };

      let accountsSynced = 0;
      let transactionsSynced = 0;
      const errors: string[] = [];

      // Sync accounts
      if (syncAccounts) {
        try {
          const providerAccounts = await provider.fetchAccounts(credentials);
          
          for (const providerAccount of providerAccounts) {
            try {
              // Check if account already exists
              const { data: existingAccount } = await supabase
                .from('provider_accounts')
                .select('*')
                .eq('connection_id', connectionId)
                .eq('provider_id', providerId)
                .eq('external_account_id', providerAccount.externalAccountId)
                .single();

              if (existingAccount) {
                // Update existing account
                await supabase
                  .from('provider_accounts')
                  .update({
                    account_name: providerAccount.accountName,
                    currency: providerAccount.currency,
                    balance: providerAccount.balance,
                    iban: providerAccount.iban,
                    status: providerAccount.status,
                    last_synced_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', existingAccount.id);

                // Update linked Stratifi account if exists
                if (existingAccount.account_id) {
                  await supabase
                    .from('accounts')
                    .update({
                      current_balance: providerAccount.balance,
                      account_status: providerAccount.status,
                      last_synced_at: new Date().toISOString(),
                    })
                    .eq('id', existingAccount.account_id);
                }
              } else {
                // Create new provider account
                const { data: newProviderAccount } = await supabase
                  .from('provider_accounts')
                  .insert({
                    tenant_id: tenantId,
                    connection_id: connectionId,
                    provider_id: providerId,
                    external_account_id: providerAccount.externalAccountId,
                    account_name: providerAccount.accountName,
                    account_number: providerAccount.accountNumber,
                    account_type: providerAccount.accountType,
                    currency: providerAccount.currency,
                    balance: providerAccount.balance,
                    iban: providerAccount.iban,
                    bic: providerAccount.bic,
                    status: providerAccount.status,
                    provider_metadata: providerAccount.metadata || {},
                    last_synced_at: new Date().toISOString(),
                  })
                  .select()
                  .single();

                // Create corresponding Stratifi account
                if (newProviderAccount) {
                  const newAccount = await createAccount({
                    tenant_id: tenantId,
                    account_name: providerAccount.accountName,
                    account_number: providerAccount.accountNumber || providerAccount.externalAccountId,
                    account_type: providerAccount.accountType,
                    account_status: providerAccount.status,
                    bank_name: provider.config.displayName,
                    currency: providerAccount.currency,
                    current_balance: providerAccount.balance,
                    external_account_id: providerAccount.externalAccountId,
                    sync_enabled: true,
                    last_synced_at: new Date().toISOString(),
                    created_by: user.id,
                  });

                  // Link the accounts
                  await supabase
                    .from('provider_accounts')
                    .update({ account_id: newAccount.id })
                    .eq('id', newProviderAccount.id);
                }
              }

              accountsSynced++;
            } catch (accountError) {
              console.error(`Error syncing account ${providerAccount.externalAccountId}:`, accountError);
              errors.push(`Account ${providerAccount.accountName}: ${provider.getErrorMessage(accountError)}`);
            }
          }
        } catch (accountsError) {
          errors.push(`Failed to fetch accounts: ${provider.getErrorMessage(accountsError)}`);
        }
      }

      // Sync transactions
      if (syncTransactions) {
        try {
          const { data: providerAccounts } = await supabase
            .from('provider_accounts')
            .select('*')
            .eq('connection_id', connectionId)
            .eq('provider_id', providerId)
            .eq('sync_enabled', true);

          if (providerAccounts && providerAccounts.length > 0) {
            for (const providerAccount of providerAccounts) {
              try {
                const transactions = await provider.fetchTransactions(
                  credentials,
                  providerAccount.external_account_id,
                  { limit: transactionLimit }
                );

                for (const transaction of transactions) {
                  try {
                    // Store in provider_transactions table
                    await supabase.from('provider_transactions').upsert(
                      {
                        tenant_id: tenantId,
                        connection_id: connectionId,
                        provider_id: providerId,
                        provider_account_id: providerAccount.id,
                        external_transaction_id: transaction.externalTransactionId,
                        external_account_id: providerAccount.external_account_id,
                        amount: transaction.amount,
                        currency: transaction.currency,
                        description: transaction.description,
                        transaction_type: transaction.type,
                        counterparty_name: transaction.counterpartyName,
                        counterparty_account: transaction.counterpartyAccount,
                        reference: transaction.reference,
                        category: transaction.category,
                        transaction_date: transaction.date.toISOString(),
                        import_status: 'pending',
                        import_job_id: ingestionJob.id,
                        provider_metadata: transaction.metadata || {},
                      },
                      {
                        onConflict: 'connection_id,provider_id,external_transaction_id',
                      }
                    );

                    // Import to main transactions table
                    if (providerAccount.account_id) {
                      await supabase.from('transactions').upsert(
                        {
                          tenant_id: tenantId,
                          account_id: providerAccount.account_id,
                          transaction_date: transaction.date.toISOString(),
                          amount: transaction.type === 'credit' ? transaction.amount : -transaction.amount,
                          currency: transaction.currency,
                          description: transaction.description,
                          transaction_type: transaction.type === 'credit' ? 'Credit' : 'Debit',
                          connection_id: connectionId,
                          external_transaction_id: transaction.externalTransactionId,
                          source_type: `${providerId}_api`,
                          import_job_id: ingestionJob.id,
                          metadata: {
                            counterparty_name: transaction.counterpartyName,
                            counterparty_account: transaction.counterpartyAccount,
                            reference: transaction.reference,
                            provider_id: providerId,
                            ...transaction.metadata,
                          },
                        },
                        {
                          onConflict: 'tenant_id,connection_id,external_transaction_id',
                        }
                      );

                      transactionsSynced++;
                    }
                  } catch (txError) {
                    console.error(`Error importing transaction:`, txError);
                  }
                }
              } catch (txFetchError) {
                errors.push(`Account ${providerAccount.account_name}: ${provider.getErrorMessage(txFetchError)}`);
              }
            }
          }
        } catch (transactionsError) {
          errors.push(`Failed to sync transactions: ${provider.getErrorMessage(transactionsError)}`);
        }
      }

      // Update ingestion job
      await updateIngestionJob(ingestionJob.id, {
        status: errors.length > 0 ? 'completed_with_errors' : 'completed',
        records_fetched: accountsSynced + transactionsSynced,
        records_imported: transactionsSynced,
        records_failed: errors.length,
        completed_at: new Date().toISOString(),
        summary: {
          accounts_synced: accountsSynced,
          transactions_synced: transactionsSynced,
          errors: errors.length > 0 ? errors : undefined,
        },
      });

      // Update connection last_sync_at
      await updateConnection(tenantId, connectionId, {
        last_sync_at: new Date().toISOString(),
      });

      // Update token last_used_at
      await supabase
        .from('provider_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      return NextResponse.json({
        success: true,
        message: `Synced ${accountsSynced} accounts and ${transactionsSynced} transactions`,
        summary: {
          accountsSynced,
          transactionsSynced,
          errors: errors.length > 0 ? errors : undefined,
        },
        jobId: ingestionJob.id,
      });
    } catch (error) {
      // Update job as failed
      await updateIngestionJob(ingestionJob.id, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      });

      throw error;
    }
  } catch (error) {
    console.error('Provider sync error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync with provider',
      },
      { status: 500 }
    );
  }
}

