// Bunq OAuth Authorization Initiation
// Creates a connection and redirects user to Bunq OAuth page

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getBunqAuthorizationUrl, generateOAuthState } from '@/lib/bunq-client';
import { createConnection } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // Create Supabase client using request cookies directly (fixes session issue)
    const supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Cannot set cookies in API route
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    console.log('Auth check:', { hasUser: !!user, authError, cookies: req.cookies.getAll().length });

    if (!user) {
      return NextResponse.json({ 
        error: 'Unauthorized', 
        details: authError?.message || 'Not authenticated',
        debug: {
          cookieCount: req.cookies.getAll().length,
          authError: authError?.message || 'No auth error',
          url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
        }
      }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { tenantId, connectionName, accountId } = body;

    console.log('📋 Request body:', { tenantId, connectionName, accountId });

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

    console.log('🔐 Tenant access check:', { userTenants, tenantError });

    if (tenantError || !userTenants) {
      return NextResponse.json(
        { error: 'You do not have access to this tenant', details: tenantError?.message },
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

    console.log('🔑 Generating OAuth state...');
    // Generate OAuth state for security
    const oauthState = generateOAuthState();

    console.log('📝 Creating connection record...');
    // Create connection record
    let connection;
    try {
      connection = await createConnection({
        tenant_id: tenantId,
        name: connectionName,
        connection_type: 'bunq_oauth',
        provider: 'bunq',
        account_id: accountId || null,
        import_mode: 'incremental',
        config: {
          environment: process.env.BUNQ_ENVIRONMENT || 'sandbox',
          created_at: new Date().toISOString(),
        },
        created_by: user.id,
        oauth_state: oauthState,
      });
      console.log('✅ Connection created:', connection.id);
    } catch (connError) {
      console.error('❌ Failed to create connection:', connError);
      return NextResponse.json(
        { 
          error: 'Failed to create connection',
          details: connError instanceof Error ? connError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    console.log('🔗 Generating Bunq authorization URL...');
    // Generate Bunq authorization URL
    let authorizationUrl;
    try {
      authorizationUrl = getBunqAuthorizationUrl(oauthState);
      console.log('✅ Authorization URL generated');
    } catch (urlError) {
      console.error('❌ Failed to generate authorization URL:', urlError);
      return NextResponse.json(
        { 
          error: 'Failed to generate authorization URL',
          details: urlError instanceof Error ? urlError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      authorizationUrl: authorizationUrl,
      message: 'Connection created. Redirect user to authorization URL.',
    });
  } catch (error) {
    console.error('❌ Bunq authorization initiation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initiate Bunq authorization',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

