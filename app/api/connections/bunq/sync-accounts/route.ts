// Bunq Sync Accounts API
// Fetches monetary accounts from Bunq and stores them

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';
import {
  getMonetaryAccounts,
  isTokenExpired,
  refreshAccessToken,
  calculateExpirationDate,
  formatBunqAmount,
  getPrimaryIban,
  getDisplayName,
} from '@/lib/bunq-client';
import { updateConnection, createAccount } from '@/lib/supabase';

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
    const { connectionId, tenantId } = body;

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

    // Get OAuth token
    const { data: tokenData, error: tokenError } = await supabase
      .from('bunq_oauth_tokens')
      .select('*')
      .eq('connection_id', connectionId)
      .is('revoked_at', null)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'OAuth token not found. Please reconnect your account.' },
        { status: 401 }
      );
    }

    let accessToken = tokenData.access_token;

    // Check if token is expired and refresh if needed
    if (tokenData.expires_at && isTokenExpired(new Date(tokenData.expires_at))) {
      if (!tokenData.refresh_token) {
        return NextResponse.json(
          { error: 'Access token expired and no refresh token available. Please reconnect.' },
          { status: 401 }
        );
      }

      try {
        const newTokens = await refreshAccessToken(tokenData.refresh_token);
        const expiresAt = calculateExpirationDate(newTokens.expires_in);

        // Update stored token
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
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return NextResponse.json(
          { error: 'Failed to refresh access token. Please reconnect your account.' },
          { status: 401 }
        );
      }
    }

    // Fetch monetary accounts from Bunq
    const bunqUserId = parseInt(tokenData.bunq_user_id);
    const monetaryAccounts = await getMonetaryAccounts(accessToken, bunqUserId);

    const syncedAccounts = [];
    const errors = [];

    // Process each monetary account
    for (const bunqAccount of monetaryAccounts) {
      try {
        const iban = getPrimaryIban(bunqAccount.alias);
        const displayName = getDisplayName(bunqAccount.alias);

        // Check if account already exists
        const { data: existingBunqAccount } = await supabase
          .from('bunq_accounts')
          .select('*')
          .eq('connection_id', connectionId)
          .eq('bunq_monetary_account_id', bunqAccount.id.toString())
          .single();

        if (existingBunqAccount) {
          // Update existing account
          await supabase
            .from('bunq_accounts')
            .update({
              description: bunqAccount.description,
              currency: bunqAccount.currency,
              balance: formatBunqAmount(bunqAccount.balance),
              iban: iban,
              display_name: displayName,
              status: bunqAccount.status.toLowerCase(),
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existingBunqAccount.id);

          // Update linked Stratifi account if it exists
          if (existingBunqAccount.account_id) {
            await supabase
              .from('accounts')
              .update({
                current_balance: formatBunqAmount(bunqAccount.balance),
                account_status: bunqAccount.status.toLowerCase(),
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', existingBunqAccount.account_id);
            
            syncedAccounts.push({
              id: existingBunqAccount.id,
              bunq_account_id: bunqAccount.id,
              stratifi_account_id: existingBunqAccount.account_id,
              action: 'updated',
            });
          } else {
            // Create Stratifi account for existing Bunq account that doesn't have one
            try {
              const newAccount = await createAccount({
                tenant_id: tenantId,
                account_name: bunqAccount.description || displayName,
                account_number: iban || bunqAccount.id.toString(),
                account_type: 'checking', // Default to checking (lowercase)
                account_status: bunqAccount.status.toLowerCase(),
                bank_name: 'Bunq',
                currency: bunqAccount.currency,
                current_balance: formatBunqAmount(bunqAccount.balance),
                external_account_id: bunqAccount.id.toString(),
                sync_enabled: true,
                last_synced_at: new Date().toISOString(),
                created_by: user.id,
              });

              // Link the accounts
              await supabase
                .from('bunq_accounts')
                .update({ account_id: newAccount.id })
                .eq('id', existingBunqAccount.id);

              syncedAccounts.push({
                id: existingBunqAccount.id,
                bunq_account_id: bunqAccount.id,
                stratifi_account_id: newAccount.id,
                action: 'created_account',
              });
            } catch (accountError) {
              console.error('Failed to create Stratifi account for existing Bunq account:', accountError);
              errors.push({
                bunq_account_id: bunqAccount.id,
                error: `Failed to create Stratifi account: ${accountError instanceof Error ? accountError.message : 'Unknown error'}`,
              });
            }
          }
        } else {
          // Create new Bunq account record
          const { data: newBunqAccount, error: createError } = await supabase
            .from('bunq_accounts')
            .insert({
              tenant_id: tenantId,
              connection_id: connectionId,
              bunq_monetary_account_id: bunqAccount.id.toString(),
              bunq_account_type: 'MonetaryAccountBank',
              description: bunqAccount.description,
              currency: bunqAccount.currency,
              balance: formatBunqAmount(bunqAccount.balance),
              iban: iban,
              display_name: displayName,
              status: bunqAccount.status.toLowerCase(),
              last_synced_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (createError) {
            throw createError;
          }

          // Always create a corresponding Stratifi account
          const newAccount = await createAccount({
            tenant_id: tenantId,
            account_name: bunqAccount.description || displayName || `Bunq Account ${bunqAccount.id}`,
            account_number: iban || bunqAccount.id.toString(),
            account_type: 'checking', // Default to checking (lowercase to match UI)
            account_status: bunqAccount.status.toLowerCase(),
            bank_name: 'Bunq',
            currency: bunqAccount.currency,
            current_balance: formatBunqAmount(bunqAccount.balance),
            available_balance: formatBunqAmount(bunqAccount.balance),
            external_account_id: bunqAccount.id.toString(),
            sync_enabled: true,
            last_synced_at: new Date().toISOString(),
            created_by: user.id,
          });

          // Link the accounts
          await supabase
            .from('bunq_accounts')
            .update({ account_id: newAccount.id })
            .eq('id', newBunqAccount.id);

          syncedAccounts.push({
            id: newBunqAccount.id,
            bunq_account_id: bunqAccount.id,
            stratifi_account_id: newAccount.id,
            action: 'created',
          });
        }
      } catch (error) {
        console.error(`Error processing account ${bunqAccount.id}:`, error);
        errors.push({
          bunq_account_id: bunqAccount.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

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
      message: `Synced ${syncedAccounts.length} accounts`,
      accounts: syncedAccounts,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Bunq sync accounts error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync accounts from Bunq',
      },
      { status: 500 }
    );
  }
}

