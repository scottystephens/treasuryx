import { supabase } from '@/lib/supabase';
import { encryptCredentialPayload } from '@/lib/security/credential-vault';

interface StoreProviderCredentialsInput {
  tenantId: string;
  connectionId: string;
  providerId: string;
  label: string;
  credentials: Record<string, string | undefined>;
  metadata?: Record<string, any>;
  createdBy: string;
}

export async function storeProviderCredentials(
  input: StoreProviderCredentialsInput
) {
  const encryptedPayload = encryptCredentialPayload(input.credentials);

  const { data, error } = await supabase
    .from('banking_provider_credentials')
    .insert({
      tenant_id: input.tenantId,
      connection_id: input.connectionId,
      provider_id: input.providerId,
      credential_label: input.label,
      encrypted_credentials: encryptedPayload,
      metadata: input.metadata ?? {},
      created_by: input.createdBy,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

