// Generic Banking Provider Card Component
// Dynamically displays available banking providers

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2 } from 'lucide-react';
import { usePlaidLink } from 'react-plaid-link';

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
  integrationType?: 'redirect' | 'plaid_link';
}

interface BankingProviderCardProps {
  provider: BankingProvider;
  tenantId: string;
  connectionName?: string;
  accountId?: string;
  onConnect?: () => void;
  onError?: (error: string) => void;
}

export function BankingProviderCard({
  provider,
  tenantId,
  connectionName,
  accountId,
  onConnect,
  onError,
}: BankingProviderCardProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // Plaid Link Hook Configuration
  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: plaidLinkToken,
    onSuccess: async (public_token, metadata) => {
      try {
        setIsConnecting(true);
        console.log('Plaid Link success, exchanging token...');
        
        // Exchange the public token for an access token
        const response = await fetch('/api/banking/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken: public_token,
            connectionId: connectionId,
            metadata: {
              institution: metadata.institution,
              accounts: metadata.accounts,
              link_session_id: metadata.link_session_id,
            }
          }),
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to exchange token');
        }

        console.log('Token exchange successful, redirecting...');
        
        if (onConnect) onConnect();
        
        // Redirect to the connection detail page
        window.location.href = data.redirectUrl || `/connections/${data.connectionId}`;

      } catch (err) {
        console.error('Plaid exchange error:', err);
        handleError(err);
      } finally {
        setIsConnecting(false);
      }
    },
    onExit: (err, metadata) => {
      setIsConnecting(false);
      if (err) {
        console.error('Plaid Link exited with error:', err);
        handleError(err);
      } else {
        console.log('Plaid Link exited without completing');
      }
    },
  });

  // Trigger Plaid Link when token is ready
  useEffect(() => {
    if (plaidLinkToken && plaidReady) {
      openPlaidLink();
    }
  }, [plaidLinkToken, plaidReady, openPlaidLink]);

  const handleError = (error: any) => {
    const errorMessage =
        error instanceof Error ? error.message : `Failed to connect to ${provider.displayName}`;
      
      if (onError) {
        onError(errorMessage);
      } else {
        alert(`Error: ${errorMessage}`);
      }
      setIsConnecting(false);
  }

  async function handleConnect() {
    try {
      setIsConnecting(true);

      // Call the generic authorize API
      const response = await fetch(`/api/banking/${provider.id}/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          connectionName: connectionName || `${provider.displayName} Connection`,
          accountId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to connect to ${provider.displayName}`);
      }

      // Handle Plaid Link Flow
      if (data.linkToken) {
          setConnectionId(data.connectionId);
          setPlaidLinkToken(data.linkToken);
          // The useEffect will trigger openPlaidLink when ready
          return;
      }

      // Handle Standard Redirect Flow
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
         throw new Error('Invalid response from authorization endpoint');
      }

    } catch (error) {
      console.error('Provider connection error:', error);
      handleError(error);
    }
  }

  return (
    <Card
      className="p-6 hover:shadow-lg transition-shadow border-2 hover:border-blue-500"
      style={{ borderColor: isConnecting ? provider.color : undefined }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: `${provider.color}20` }}
          >
            {provider.logo ? (
              <img
                src={provider.logo}
                alt={provider.displayName}
                className="h-8 w-8"
              />
            ) : (
              <Building2
                className="h-8 w-8"
                style={{ color: provider.color }}
              />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{provider.displayName}</h3>
            <Badge variant="secondary" className="text-xs">
              {provider.authType.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 flex-1">
          {provider.description}
        </p>

        {/* Features */}
        <div className="space-y-2 mb-4">
          {provider.supportsSync && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-green-600">✓</span>
              <span>Automatic sync</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-green-600">✓</span>
            <span>Supports {provider.supportedCountries.length} countries</span>
          </div>
        </div>

        {/* Connect Button */}
        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full"
          style={{
            backgroundColor: isConnecting ? undefined : provider.color,
            borderColor: provider.color,
          }}
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            `Connect ${provider.displayName}`
          )}
        </Button>

        {/* Link */}
        <a
          href={provider.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-center text-muted-foreground hover:underline mt-2"
        >
          Learn more →
        </a>
      </div>
    </Card>
  );
}
