// Bunq Sync Transactions API
// Fetches payments/transactions from Bunq and stores them

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';
import {
  getPayments,
  isTokenExpired,
  refreshAccessToken,
  calculateExpirationDate,
  formatBunqAmount,
} from '@/lib/bunq-client';
import { updateConnection, createIngestionJob, updateIngestionJob } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // Get user from server-side client
    const supabaseClient = await createClient();
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { connectionId, tenantId, count = 200 } = body;

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
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Create ingestion job
    const ingestionJob = await createIngestionJob({
      tenant_id: tenantId,
      connection_id: connectionId,
      job_type: 'bunq_sync_transactions',
      status: 'running',
    });

    try {
      // Get OAuth token
      const { data: tokenData, error: tokenError } = await supabase
        .from('bunq_oauth_tokens')
        .select('*')
        .eq('connection_id', connectionId)
        .is('revoked_at', null)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('OAuth token not found. Please reconnect your account.');
      }

      let accessToken = tokenData.access_token;

      // Check if token is expired and refresh if needed
      if (tokenData.expires_at && isTokenExpired(new Date(tokenData.expires_at))) {
        if (!tokenData.refresh_token) {
          throw new Error('Access token expired and no refresh token available.');
        }

        const newTokens = await refreshAccessToken(tokenData.refresh_token);
        const expiresAt = calculateExpirationDate(newTokens.expires_in);

        await supabase
          .from('bunq_oauth_tokens')
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token || tokenData.refresh_token,
            expires_at: expiresAt.toISOString(),
            last_used_at: new Date().toISOString(),
          })
          .eq('id', tokenData.id);

        accessToken = newTokens.access_token;
      }

      // Get Bunq accounts
      const { data: bunqAccounts, error: accountsError } = await supabase
        .from('bunq_accounts')
        .select('*')
        .eq('connection_id', connectionId)
        .eq('sync_enabled', true);

      if (accountsError || !bunqAccounts || bunqAccounts.length === 0) {
        throw new Error('No Bunq accounts found. Please sync accounts first.');
      }

      const bunqUserId = parseInt(tokenData.bunq_user_id);
      let totalFetched = 0;
      let totalProcessed = 0;
      let totalImported = 0;
      let totalSkipped = 0;
      const errors: any[] = [];

      // Fetch transactions for each account
      for (const bunqAccount of bunqAccounts) {
        try {
          const accountId = parseInt(bunqAccount.bunq_monetary_account_id);
          const payments = await getPayments(accessToken, bunqUserId, accountId, { count });

          totalFetched += payments.length;

          // Store transactions in staging table
          for (const payment of payments) {
            try {
              totalProcessed++;

              // Determine counterparty info
              const counterpartyName =
                payment.counterparty_alias.name ||
                payment.counterparty_alias.value ||
                'Unknown';
              const counterpartyIban =
                payment.counterparty_alias.type === 'IBAN'
                  ? payment.counterparty_alias.value
                  : null;

              // Check if transaction already exists in staging
              const { data: existingTransaction } = await supabase
                .from('bunq_transactions_staging')
                .select('id, imported_to_transactions')
                .eq('connection_id', connectionId)
                .eq('bunq_payment_id', payment.id.toString())
                .single();

              if (existingTransaction) {
                if (existingTransaction.imported_to_transactions) {
                  totalSkipped++;
                  continue;
                }
                // Update existing staging record
                await supabase
                  .from('bunq_transactions_staging')
                  .update({
                    amount: formatBunqAmount(payment.amount),
                    description: payment.description,
                    transaction_date: payment.created,
                    raw_data: payment,
                  })
                  .eq('id', existingTransaction.id);
              } else {
                // Insert new staging record
                await supabase.from('bunq_transactions_staging').insert({
                  tenant_id: tenantId,
                  connection_id: connectionId,
                  bunq_account_id: bunqAccount.id,
                  bunq_payment_id: payment.id.toString(),
                  bunq_monetary_account_id: accountId.toString(),
                  amount: formatBunqAmount(payment.amount),
                  currency: payment.amount.currency,
                  description: payment.description,
                  transaction_type: payment.type,
                  counterparty_name: counterpartyName,
                  counterparty_iban: counterpartyIban,
                  transaction_date: payment.created,
                  created_timestamp: payment.created,
                  import_job_id: ingestionJob.id,
                  raw_data: payment,
                });
              }

              // Import directly to transactions table
              if (bunqAccount.account_id) {
                const { error: transactionError } = await supabase
                  .from('transactions')
                  .upsert(
                    {
                      tenant_id: tenantId,
                      account_id: bunqAccount.account_id,
                      transaction_date: payment.created,
                      amount: formatBunqAmount(payment.amount),
                      currency: payment.amount.currency,
                      description: payment.description,
                      transaction_type: formatBunqAmount(payment.amount) >= 0 ? 'Credit' : 'Debit',
                      connection_id: connectionId,
                      external_transaction_id: payment.id.toString(),
                      source_type: 'bunq_api',
                      import_job_id: ingestionJob.id,
                      metadata: {
                        counterparty_name: counterpartyName,
                        counterparty_iban: counterpartyIban,
                        bunq_payment_id: payment.id.toString(),
                        bunq_payment_type: payment.type,
                      },
                    },
                    {
                      onConflict: 'tenant_id,connection_id,external_transaction_id',
                    }
                  );

                if (transactionError) {
                  console.error('Transaction import error:', transactionError);
                  errors.push({
                    payment_id: payment.id,
                    error: transactionError.message,
                  });
                } else {
                  totalImported++;
                }
              }
            } catch (paymentError) {
              console.error(`Error processing payment ${payment.id}:`, paymentError);
              errors.push({
                payment_id: payment.id,
                error: paymentError instanceof Error ? paymentError.message : 'Unknown error',
              });
            }
          }
        } catch (accountError) {
          console.error(
            `Error fetching payments for account ${bunqAccount.bunq_monetary_account_id}:`,
            accountError
          );
          errors.push({
            bunq_account_id: bunqAccount.bunq_monetary_account_id,
            error: accountError instanceof Error ? accountError.message : 'Unknown error',
          });
        }
      }

      // Update ingestion job
      await updateIngestionJob(ingestionJob.id, {
        status: 'completed',
        records_fetched: totalFetched,
        records_processed: totalProcessed,
        records_imported: totalImported,
        records_skipped: totalSkipped,
        records_failed: errors.length,
        completed_at: new Date().toISOString(),
        summary: {
          accounts_synced: bunqAccounts.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      });

      // Update connection last_sync_at
      await updateConnection(tenantId, connectionId, {
        last_sync_at: new Date().toISOString(),
      });

      // Update token last_used_at
      await supabase
        .from('bunq_oauth_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      return NextResponse.json({
        success: true,
        message: `Synced transactions from ${bunqAccounts.length} accounts`,
        summary: {
          fetched: totalFetched,
          processed: totalProcessed,
          imported: totalImported,
          skipped: totalSkipped,
          failed: errors.length,
        },
        job_id: ingestionJob.id,
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
    console.error('Bunq sync transactions error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync transactions from Bunq',
      },
      { status: 500 }
    );
  }
}

