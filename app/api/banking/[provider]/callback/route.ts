// Generic Banking Provider OAuth Callback
// Handles OAuth callback for any banking provider

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getProvider } from '@/lib/banking-providers/provider-registry';
import { supabase, updateConnection } from '@/lib/supabase';

export async function GET(
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
      return NextResponse.redirect(
        new URL(
          '/login?error=unauthorized&message=Please log in to continue',
          req.url
        )
      );
    }

    // Get the banking provider
    let provider;
    try {
      provider = getProvider(providerId);
    } catch (error) {
      return NextResponse.redirect(
        new URL(
          `/connections/new?error=provider_not_found&message=${encodeURIComponent(
            `Provider '${providerId}' not found`
          )}`,
          req.url
        )
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
      console.error('OAuth error:', error, errorDescription);
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
        new URL(
          '/connections/new?error=invalid_oauth&message=Missing OAuth parameters',
          req.url
        )
      );
    }

    // Find the connection with this OAuth state
    const { data: connections, error: connectionError } = await supabase
      .from('connections')
      .select('*')
      .eq('oauth_state', state)
      .eq('created_by', user.id)
      .eq('provider', providerId)
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
      const tokens = await provider.exchangeCodeForToken(code);

      // Get user info from provider
      console.log('Fetching user info...');
      const userInfo = await provider.fetchUserInfo({
        connectionId: connection.id,
        tenantId: connection.tenant_id,
        tokens,
      });

      // Store OAuth tokens in generic provider_tokens table
      const { error: tokenError } = await supabase.from('provider_tokens').insert({
        tenant_id: connection.tenant_id,
        connection_id: connection.id,
        provider_id: providerId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken || null,
        token_type: tokens.tokenType || 'Bearer',
        expires_at: tokens.expiresAt?.toISOString() || null,
        scopes: tokens.scope || [],
        provider_user_id: userInfo.userId,
        provider_metadata: userInfo.metadata || {},
        status: 'active',
      });

      if (tokenError) {
        throw new Error(`Failed to store OAuth token: ${tokenError.message}`);
      }

      // Update connection status
      await updateConnection(connection.tenant_id, connection.id, {
        status: 'active',
        config: {
          ...connection.config,
          provider_user_id: userInfo.userId,
          provider_user_name: userInfo.name,
          connected_at: new Date().toISOString(),
        },
      });

      // Clear OAuth state (one-time use)
      await supabase
        .from('connections')
        .update({ oauth_state: null })
        .eq('id', connection.id);

      // Redirect to connection details page
      return NextResponse.redirect(
        new URL(
          `/connections/${connection.id}?success=true&message=Successfully connected to ${provider.config.displayName}`,
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
    console.error('OAuth callback error:', error);
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

