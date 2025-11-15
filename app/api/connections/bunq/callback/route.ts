// Bunq OAuth Callback Handler
// Handles the OAuth authorization callback from Bunq

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  exchangeCodeForToken,
  calculateExpirationDate,
  getUserInfo,
  getMonetaryAccounts,
  formatBunqAmount,
  getPrimaryIban,
  getDisplayName,
} from '@/lib/bunq-client';
import { supabase } from '@/lib/supabase';
import { updateConnection, createAccount } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    // Get user from server-side client
    const supabaseClient = await createClient();
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL('/login?error=unauthorized&message=Please log in to continue', req.url)
      );
    }

    // Get OAuth parameters from query string
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('Bunq OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(
          `/connections/new?error=oauth_failed&message=${encodeURIComponent(
            errorDescription || 'OAuth authorization failed'
          )}`,
          req.url
        )
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/connections/new?error=invalid_oauth&message=Missing OAuth parameters', req.url)
      );
    }

    // Find the connection with this OAuth state
    const { data: connections, error: connectionError } = await supabase
      .from('connections')
      .select('*')
      .eq('oauth_state', state)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (connectionError || !connections || connections.length === 0) {
      console.error('Connection not found for state:', state, connectionError);
      return NextResponse.redirect(
        new URL(
          '/connections/new?error=invalid_state&message=Invalid OAuth state. Please try again.',
          req.url
        )
      );
    }

    const connection = connections[0];

    try {
      // Exchange authorization code for access token
      console.log('Exchanging code for token...');
      const tokenResponse = await exchangeCodeForToken(code);

      // Get user info from Bunq
      console.log('Fetching Bunq user info...');
      const bunqUserInfo = await getUserInfo(tokenResponse.access_token);

      // Calculate token expiration
      const expiresAt = calculateExpirationDate(tokenResponse.expires_in);

      // Store OAuth tokens in database
      const { error: tokenError } = await supabase
        .from('bunq_oauth_tokens')
        .insert({
          tenant_id: connection.tenant_id,
          connection_id: connection.id,
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token || null,
          token_type: tokenResponse.token_type,
          expires_at: expiresAt.toISOString(),
          bunq_user_id: bunqUserInfo.id.toString(),
          bunq_user_type: bunqUserInfo.legal_name ? 'UserCompany' : 'UserPerson',
          bunq_environment: process.env.BUNQ_ENVIRONMENT || 'sandbox',
          scopes: tokenResponse.scope ? tokenResponse.scope.split(' ') : [],
          authorized_at: new Date().toISOString(),
        });

      if (tokenError) {
        throw new Error(`Failed to store OAuth token: ${tokenError.message}`);
      }

      // Update connection status
      await updateConnection(connection.tenant_id, connection.id, {
        status: 'active',
        config: {
          ...connection.config,
          bunq_user_id: bunqUserInfo.id,
          bunq_display_name: bunqUserInfo.display_name || bunqUserInfo.legal_name,
          bunq_user_type: bunqUserInfo.legal_name ? 'UserCompany' : 'UserPerson',
          connected_at: new Date().toISOString(),
        },
      });

      // Clear OAuth state (one-time use)
      await supabase
        .from('connections')
        .update({ oauth_state: null })
        .eq('id', connection.id);

      // Automatically sync accounts after successful connection
      // Do this in the background so OAuth callback completes quickly
      (async () => {
        try {
          console.log('🔄 Auto-syncing accounts after OAuth connection...');
          const monetaryAccounts = await getMonetaryAccounts(tokenResponse.access_token, bunqUserInfo.id);
          
          for (const bunqAccount of monetaryAccounts) {
            try {
              const iban = getPrimaryIban(bunqAccount.alias);
              const displayName = getDisplayName(bunqAccount.alias);

              // Check if Bunq account record exists
              const { data: existingBunqAccount } = await supabase
                .from('bunq_accounts')
                .select('*')
                .eq('connection_id', connection.id)
                .eq('bunq_monetary_account_id', bunqAccount.id.toString())
                .single();

              let bunqAccountRecordId;
              if (existingBunqAccount) {
                bunqAccountRecordId = existingBunqAccount.id;
                // Update existing record
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
              } else {
                // Create new Bunq account record
                const { data: newBunqAccount } = await supabase
                  .from('bunq_accounts')
                  .insert({
                    tenant_id: connection.tenant_id,
                    connection_id: connection.id,
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
                
                bunqAccountRecordId = newBunqAccount?.id;
              }

              // Create Stratifi account if it doesn't exist
              if (bunqAccountRecordId) {
                const { data: bunqAccountRecord } = await supabase
                  .from('bunq_accounts')
                  .select('account_id')
                  .eq('id', bunqAccountRecordId)
                  .single();

                if (!bunqAccountRecord?.account_id) {
                  const newAccount = await createAccount({
                    tenant_id: connection.tenant_id,
                    account_name: bunqAccount.description || displayName || `Bunq Account ${bunqAccount.id}`,
                    account_number: iban || bunqAccount.id.toString(),
                    account_type: 'checking',
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
                    .eq('id', bunqAccountRecordId);
                  
                  console.log(`✅ Created Stratifi account: ${newAccount.account_name}`);
                }
              }
            } catch (accountError) {
              console.error(`Error syncing account ${bunqAccount.id}:`, accountError);
            }
          }
          console.log('✅ Account sync completed');
        } catch (syncError) {
          // Log but don't fail the OAuth callback if sync fails
          console.error('Background account sync failed:', syncError);
        }
      })();

      // Redirect to connections page (accounts will appear after sync completes)
      return NextResponse.redirect(
        new URL(
          `/connections?success=true&message=Successfully connected to Bunq. Accounts are being synced...`,
          req.url
        )
      );
    } catch (tokenError) {
      console.error('Error during token exchange or user info fetch:', tokenError);

      // Update connection with error
      await updateConnection(connection.tenant_id, connection.id, {
        status: 'error',
        last_error: tokenError instanceof Error ? tokenError.message : 'Unknown error',
      });

      return NextResponse.redirect(
        new URL(
          `/connections/new?error=oauth_failed&message=${encodeURIComponent(
            tokenError instanceof Error ? tokenError.message : 'Failed to complete OAuth flow'
          )}`,
          req.url
        )
      );
    }
  } catch (error) {
    console.error('Bunq OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(
        `/connections/new?error=server_error&message=${encodeURIComponent(
          'An unexpected error occurred. Please try again.'
        )}`,
        req.url
      )
    );
  }
}

