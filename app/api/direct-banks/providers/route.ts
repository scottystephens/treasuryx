import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { directBankProviders } from '@/lib/direct-bank-providers';

export async function GET() {
  try {
    const { data: docs, error } = await supabase
      .from('direct_bank_provider_docs')
      .select('*');

    let docRows = docs || [];

    if (error) {
      console.error('Failed to fetch direct bank docs:', error);
      if (error.code !== 'PGRST205') {
        return NextResponse.json(
          { error: 'Failed to fetch direct bank providers' },
          { status: 500 }
        );
      } else {
        docRows = [];
      }
    }

    const providers = directBankProviders.map((provider) => {
      const providerDocs = docRows.filter((doc) => doc.provider_id === provider.id);

      return {
        ...provider,
        credentialFields: provider.credentialFields.map((field) => {
          const doc = providerDocs.find((item) => item.field_key === field.key);
          return {
            ...field,
            doc,
          };
        }),
      };
    });

    return NextResponse.json({
      success: true,
      providers,
    });
  } catch (error) {
    console.error('Direct bank provider API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch direct bank providers' },
      { status: 500 }
    );
  }
}

