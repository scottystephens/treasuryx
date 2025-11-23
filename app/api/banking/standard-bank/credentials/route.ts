import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createConnection, supabase } from '@/lib/supabase';
import { storeProviderCredentials } from '@/lib/services/banking-credential-service';
import { getDirectBankProvider } from '@/lib/direct-bank-providers';

export async function POST(req: NextRequest) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      tenantId,
      connectionName,
      providerId,
      environment = 'sandbox',
      notes,
      credentials = {},
    } = body;

    if (!tenantId || !providerId) {
      return NextResponse.json(
        { error: 'Tenant ID and provider ID are required' },
        { status: 400 }
      );
    }

    const provider = getDirectBankProvider(providerId);
    if (!provider) {
      return NextResponse.json(
        { error: `Direct bank provider '${providerId}' is not supported` },
        { status: 400 }
      );
    }

    const missingField = provider.credentialFields.find(
      (field) => field.required && !credentials[field.key]
    );

    if (missingField) {
      return NextResponse.json(
        { error: `Missing required field: ${missingField.label}` },
        { status: 400 }
      );
    }

    const normalizedEnvironment = provider.environmentOptions.some(
      (option) => option.value === environment
    )
      ? environment
      : provider.environmentOptions[0]?.value || 'sandbox';

    const normalizedCredentials = {
      ...credentials,
      clientId: credentials.appId || credentials.clientId,
    };

    const { data: membership, error: membershipError } = await supabaseClient
      .from('user_tenants')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'You do not have access to this tenant' },
        { status: 403 }
      );
    }

    if (!['owner', 'admin', 'editor'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to manage connections for this tenant' },
        { status: 403 }
      );
    }

    const { data: existingConnection } = await supabase
      .from('connections')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('provider', providerId)
      .limit(1)
      .maybeSingle();

    if (existingConnection) {
      return NextResponse.json(
        { error: `${provider.name} credentials have already been provided for this tenant` },
        { status: 409 }
      );
    }

    const connection = await createConnection({
      tenant_id: tenantId,
      name: connectionName?.trim() || provider.name,
      connection_type: `${provider.id}_api`,
      provider: provider.id,
      config: {
        provider: provider.id,
        environment: normalizedEnvironment,
        bank_name: provider.name,
        credential_status: 'received',
        notes: notes || null,
      },
      import_mode: 'manual',
      created_by: user.id,
    });

    await storeProviderCredentials({
      tenantId,
      connectionId: connection.id,
      providerId: provider.id,
      label: `${provider.shortName} (${normalizedEnvironment})`,
      credentials: normalizedCredentials,
      metadata: {
        environment: normalizedEnvironment,
        notes: notes || null,
      },
      createdBy: user.id,
    });

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      message: 'Credentials stored securely. We will update you when the direct integration is active.',
    });
  } catch (error) {
    console.error('Standard Bank credential intake failed:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to capture Standard Bank credentials',
      },
      { status: 500 }
    );
  }
}

