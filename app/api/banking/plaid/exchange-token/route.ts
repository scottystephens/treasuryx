import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getProvider } from '@/lib/banking-providers/provider-registry';
import { updateConnection } from '@/lib/supabase';
import { performSync } from '@/lib/services/sync-service';

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
    const { publicToken, connectionId, metadata } = body;

    if (!publicToken || !connectionId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get the connection to verify ownership and provider
    // Note: Using service role client (via updateConnection internal logic) or checking ownership here
    // For safety, let's verify ownership first
    const { data: connection, error: connectionError } = await supabaseClient
      .from('connections')
      .select('*')
      .eq('id', connectionId)
      .eq('created_by', user.id)
      .single();

    if (connectionError || !connection) {
        return NextResponse.json(
            { error: 'Connection not found or unauthorized' },
            { status: 404 }
        );
    }

    const providerId = connection.provider;
    const provider = getProvider(providerId);

    // Exchange token using the provider implementation
    // We use exchangeCodeForToken interface method, where code = public_token
    const tokens = await provider.exchangeCodeForToken(publicToken);

    // Get user info from provider if possible
    let userInfo = { userId: user.id, name: 'Plaid User' };
    try {
        const providerUser = await provider.fetchUserInfo({
            connectionId: connection.id,
            tenantId: connection.tenant_id,
            tokens: tokens
        });
        userInfo = { userId: providerUser.userId, name: providerUser.name };
    } catch (e) {
        console.warn('Could not fetch provider user info, using defaults', e);
    }

    // Update connection in database
    await updateConnection(connection.tenant_id, connectionId, {
        status: 'active',
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken, // Plaid: Item ID
        expires_at: null, // Plaid tokens don't expire
        metadata: {
            ...connection.metadata,
            ...metadata, // Plaid metadata (institution, accounts, etc.)
            provider_user_id: userInfo.userId
        },
        last_sync_at: new Date().toISOString()
    });

    // Trigger initial sync
    // Run in background so we respond quickly to UI
    (async () => {
        try {
            console.log(`Starting initial sync for connection ${connectionId}`);
            await performSync({
                connectionId,
                tenantId: connection.tenant_id,
                providerId,
                userId: user.id,
                syncAccounts: true,
                syncTransactions: true,
                forceSync: true
            });
            console.log(`Initial sync completed for connection ${connectionId}`);
        } catch (syncError) {
            console.error(`Initial sync failed for connection ${connectionId}`, syncError);
        }
    })();

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to exchange token',
      },
      { status: 500 }
    );
  }
}

