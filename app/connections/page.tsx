'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/tenant-context';
import { Navigation } from '@/components/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Database, Trash2, Calendar, Building2, RefreshCw } from 'lucide-react';
import { useConnections, useDeleteConnection, useSyncConnection } from '@/lib/hooks/use-connections';
import { toast } from 'sonner';

interface Connection {
  id: string;
  name: string;
  connection_type: string;
  status: string;
  account_id: string;
  import_mode: string;
  last_sync_at: string | null;
  created_at: string;
  data_type?: string;
  supports_transactions?: boolean;
  supports_statements?: boolean;
  last_error?: string | null;
  provider?: string; // Banking provider ID (e.g., 'tink')
}

export default function ConnectionsPage() {
  const router = useRouter();
  const { currentTenant, userTenants } = useTenant();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Use React Query for connections
  const { data: connections = [], isLoading: loading, error } = useConnections(currentTenant?.id);
  const deleteConnectionMutation = useDeleteConnection();
  const syncMutation = useSyncConnection();

  useEffect(() => {
    // Only redirect to onboarding if user genuinely has no organizations AND is not loading
    // Don't redirect just because connections list is empty
    if (userTenants.length === 0 && !loading && !currentTenant) {
      router.push('/onboarding');
      return;
    }
  }, [userTenants, loading, currentTenant, router]);

  // Show error toast if query fails
  useEffect(() => {
    if (error) {
      toast.error('Failed to load connections', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [error]);

  async function handleDelete(connectionId: string) {
    if (!currentTenant) return;
    if (!confirm('Are you sure you want to delete this connection? This will not delete imported transactions.')) {
      return;
    }

    setDeleting(connectionId);
    deleteConnectionMutation.mutate(
      { connectionId, tenantId: currentTenant.id },
      {
        onSettled: () => setDeleting(null),
      }
    );
  }

  async function handleSyncBankingProvider(connectionId: string, providerId: string) {
    if (!currentTenant) return;
    
    setSyncing(connectionId);
    syncMutation.mutate(
      {
        provider: providerId,
        connectionId,
        tenantId: currentTenant.id,
        forceSync: true,
      },
      {
        onSettled: () => setSyncing(null),
      }
    );
  }

  function getConnectionIcon(type: string) {
    switch (type) {
      case 'csv':
        return <FileText className="h-5 w-5" />;
      case 'bai2':
        return <Database className="h-5 w-5" />;
      default:
        // For banking providers, use generic icon
        return <Building2 className="h-5 w-5" />;
    }
  }
  
  function getConnectionColor(type: string) {
    switch (type) {
      case 'csv':
        return 'bg-blue-100';
      default:
        // For banking providers, use generic color
        return 'bg-blue-100';
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getDataTypeBadges(connection: Connection) {
    const badges = [];
    
    if (connection.supports_transactions) {
      badges.push({
        label: 'Transactions',
        color: 'bg-blue-100 text-blue-800',
        icon: '💰'
      });
    }
    
    if (connection.supports_statements) {
      badges.push({
        label: 'Statements',
        color: 'bg-purple-100 text-purple-800',
        icon: '📊'
      });
    }
    
    // Fallback if no specific flags set
    if (badges.length === 0) {
      if (connection.data_type === 'statements') {
        badges.push({
          label: 'Statements',
          color: 'bg-purple-100 text-purple-800',
          icon: '📊'
        });
      } else {
        badges.push({
          label: 'Transactions',
          color: 'bg-blue-100 text-blue-800',
          icon: '💰'
        });
      }
    }
    
    return badges;
  }

  if (!currentTenant) {
    return (
      <div className="flex h-screen">
        <main className="flex-1 overflow-y-auto bg-background p-8">
          <Card className="p-12 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4">No Organization Selected</h2>
            <p className="text-muted-foreground mb-6">
              {userTenants.length === 0
                ? "You don't have any organizations yet. Create one to get started."
                : "Please select an organization from the sidebar to view connections."}
            </p>
            {userTenants.length === 0 && (
              <Button onClick={() => router.push('/onboarding')}>
                Create Organization
              </Button>
            )}
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Navigation />
      
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">Data Connections</h1>
              <p className="text-muted-foreground mt-2">
                Manage your data import connections
              </p>
            </div>
            <Button
              onClick={() => router.push('/connections/new')}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Connection
            </Button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <p>Loading connections...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && connections.length === 0 && (
            <Card className="p-12 text-center">
              <div className="flex justify-center mb-4">
                <Database className="h-16 w-16 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">No connections yet</h2>
              <p className="text-muted-foreground mb-6">
                Get started by creating your first data connection
              </p>
              <Button onClick={() => router.push('/connections/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Connection
              </Button>
            </Card>
          )}

          {/* Connections Grid */}
          {!loading && connections.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {connections.map((connection: Connection) => (
                <Card key={connection.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 ${getConnectionColor(connection.connection_type)} rounded-lg`}>
                        {getConnectionIcon(connection.connection_type)}
                      </div>
                      <div>
                        <h3 className="font-semibold">{connection.name}</h3>
                        <p className="text-sm text-muted-foreground uppercase">
                          {connection.connection_type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {connection.provider && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSyncBankingProvider(connection.id, connection.provider!)}
                          disabled={syncing === connection.id}
                          title="Sync now"
                        >
                          <RefreshCw
                            className={`h-4 w-4 text-blue-600 ${
                              syncing === connection.id ? 'animate-spin' : ''
                            }`}
                          />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(connection.id)}
                        disabled={deleting === connection.id}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge 
                        className={getStatusColor(connection.status)}
                        title={connection.status === 'error' && connection.last_error ? connection.last_error : undefined}
                      >
                        {connection.status}
                      </Badge>
                    </div>

                    {/* Show error message if exists */}
                    {connection.status === 'error' && connection.last_error && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                        <strong>Error:</strong> {connection.last_error}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Data Type</span>
                      <div className="flex gap-1">
                        {getDataTypeBadges(connection).map((badge, idx) => (
                          <Badge key={idx} className={`${badge.color} text-xs`}>
                            {badge.icon} {badge.label}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Import Mode</span>
                      <span className="text-sm font-medium capitalize">
                        {connection.import_mode}
                      </span>
                    </div>

                    {connection.last_sync_at && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Last sync: {new Date(connection.last_sync_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/connections/${connection.id}`)}
                      className="flex-1"
                    >
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/connections/${connection.id}/history`)}
                      className="flex-1"
                    >
                      History
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

