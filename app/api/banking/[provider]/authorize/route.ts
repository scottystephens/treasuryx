// Generic Banking Provider Authorization
// Handles OAuth initiation for any banking provider

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getProvider } from '@/lib/banking-providers/provider-registry';
import { createConnection } from '@/lib/supabase';
import crypto from 'crypto';

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
    let provider;
    try {
      provider = getProvider(providerId);
    } catch (error) {
      return NextResponse.json(
        { error: `Banking provider '${providerId}' not found or not enabled` },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { tenantId, connectionName, accountId } = body;

    if (!tenantId || !connectionName) {
      return NextResponse.json(
        { error: 'Tenant ID and connection name are required' },
        { status: 400 }
      );
    }

    // Verify user has access to this tenant
    const { data: userTenants, error: tenantError } = await supabaseClient
      .from('user_tenants')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (tenantError || !userTenants) {
      return NextResponse.json(
        { error: 'You do not have access to this tenant' },
        { status: 403 }
      );
    }

    // Check if user has permission to create connections
    if (!['owner', 'admin', 'editor'].includes(userTenants.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to create connections' },
        { status: 403 }
      );
    }

    // Generate OAuth state for security
    const oauthState = crypto.randomBytes(32).toString('hex');

    // Create connection record
    const connection = await createConnection({
      tenant_id: tenantId,
      name: connectionName,
      connection_type: `${providerId}_oauth`,
      provider: providerId,
      account_id: accountId || null,
      import_mode: 'incremental',
      config: {
        provider_id: providerId,
        created_at: new Date().toISOString(),
      },
      created_by: user.id,
      oauth_state: oauthState,
    });

    let responseData: any = {
        success: true,
        connectionId: connection.id,
        provider: {
            id: providerId,
            name: provider.config.displayName,
            integrationType: provider.config.integrationType
        }
    };

    if (provider.config.integrationType === 'plaid_link') {
        if (!provider.createLinkToken) {
             throw new Error('Provider is configured for Plaid Link but missing createLinkToken method');
        }
        
        const linkToken = await provider.createLinkToken(user.id, {
            connection_id: connection.id,
            tenant_id: tenantId
        });
        
        responseData.linkToken = linkToken;
        responseData.message = 'Link token created. Initialize Plaid Link.';
    } else {
        // Standard OAuth redirect flow
        const authorizationUrl = provider.getAuthorizationUrl(oauthState, {
            connection_id: connection.id,
            tenant_id: tenantId,
        });
        
        responseData.authorizationUrl = authorizationUrl;
        responseData.message = 'Connection created. Redirect user to authorization URL.';
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Banking authorization initiation error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to initiate banking authorization',
      },
      { status: 500 }
    );
  }
}

