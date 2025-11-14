// Bunq Connect Button Component
// Handles the OAuth flow initiation for Bunq banking connection

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface BunqConnectButtonProps {
  tenantId: string;
  connectionName?: string;
  accountId?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function BunqConnectButton({
  tenantId,
  connectionName = 'Bunq Banking Connection',
  accountId,
  onSuccess,
  onError,
}: BunqConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  async function handleConnect() {
    try {
      setIsConnecting(true);

      // Call the authorize API to create connection and get OAuth URL
      const response = await fetch('/api/connections/bunq/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          connectionName,
          accountId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to initiate Bunq connection');
      }

      // Redirect to Bunq OAuth page
      window.location.href = data.authorizationUrl;
    } catch (error) {
      console.error('Bunq connection error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to connect to Bunq';
      
      if (onError) {
        onError(errorMessage);
      } else {
        alert(`Error: ${errorMessage}`);
      }
      
      setIsConnecting(false);
    }
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      className="w-full"
    >
      {isConnecting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Connecting to Bunq...
        </>
      ) : (
        <>Connect with Bunq</>
      )}
    </Button>
  );
}

