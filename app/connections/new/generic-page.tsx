// Generic Banking Provider Connection Page
// Dynamically shows all available banking providers

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/tenant-context';
import { Navigation } from '@/components/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BankingProviderCard } from '@/components/banking-provider-card';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';

interface BankingProvider {
  id: string;
  displayName: string;
  logo?: string;
  color: string;
  description: string;
  authType: 'oauth' | 'api_key' | 'open_banking';
  supportsSync: boolean;
  supportedCountries: string[];
  website: string;
}

export default function GenericConnectionPage() {
  const router = useRouter();
  const { currentTenant } = useTenant();
  const [providers, setProviders] = useState<BankingProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentTenant) {
      loadProviders();
    }
  }, [currentTenant]);

  async function loadProviders() {
    try {
      setLoading(true);
      const response = await fetch('/api/banking/providers');
      const data = await response.json();

      if (data.success) {
        setProviders(data.providers);
      } else {
        setError(data.error || 'Failed to load providers');
      }
    } catch (err) {
      console.error('Error loading providers:', err);
      setError('Failed to load banking providers');
    } finally {
      setLoading(false);
    }
  }

  if (!currentTenant) {
    return (
      <div className="flex h-screen">
        <Navigation />
        <main className="flex-1 overflow-y-auto bg-background p-8">
          <Card className="p-12 text-center max-w-2xl mx-auto mt-8">
            <h2 className="text-2xl font-semibold mb-4">No Organization Selected</h2>
            <p className="text-muted-foreground mb-6">
              Please select an organization from the sidebar to connect banking providers.
            </p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Navigation />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => router.push('/connections')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Connections
            </Button>
            <h1 className="text-3xl font-bold">Connect Banking Provider</h1>
            <p className="text-muted-foreground mt-2">
              Choose a banking provider to connect your accounts
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <p>Loading banking providers...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <Card className="p-8 text-center border-red-200 bg-red-50">
              <p className="text-red-800">{error}</p>
              <Button onClick={loadProviders} className="mt-4">
                Retry
              </Button>
            </Card>
          )}

          {/* Providers Grid */}
          {!loading && !error && (
            <>
              {/* Banking Providers */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Banking Providers</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {providers.map((provider) => (
                    <BankingProviderCard
                      key={provider.id}
                      provider={provider}
                      tenantId={currentTenant.id}
                      onError={(err) => setError(err)}
                    />
                  ))}
                </div>
              </div>

              {/* CSV Import Option */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Manual Import</h2>
                <Card
                  className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500 max-w-md"
                  onClick={() => router.push('/connections/new')}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">CSV Import</h3>
                      <p className="text-sm text-muted-foreground">
                        Upload a CSV file with transactions
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Empty State */}
              {providers.length === 0 && (
                <Card className="p-12 text-center">
                  <h2 className="text-2xl font-semibold mb-2">
                    No Providers Available
                  </h2>
                  <p className="text-muted-foreground">
                    No banking providers are currently configured. Please contact support.
                  </p>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

