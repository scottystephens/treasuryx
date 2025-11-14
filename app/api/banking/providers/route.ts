// Generic Banking Providers API
// Lists all available banking providers

import { NextResponse } from 'next/server';
import { getEnabledProviders } from '@/lib/banking-providers/provider-registry';

export async function GET() {
  try {
    const providers = getEnabledProviders();
    
    const providersData = providers.map((provider) => ({
      id: provider.config.providerId,
      displayName: provider.config.displayName,
      logo: provider.config.logo,
      color: provider.config.color,
      description: provider.config.description,
      authType: provider.config.authType,
      supportsSync: provider.config.supportsSync,
      supportedCountries: provider.config.supportedCountries,
      website: provider.config.website,
    }));

    return NextResponse.json({
      success: true,
      providers: providersData,
      count: providersData.length,
    });
  } catch (error) {
    console.error('Error fetching banking providers:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch banking providers',
      },
      { status: 500 }
    );
  }
}

