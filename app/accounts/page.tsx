'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/auth-context';
import { Navigation } from '@/components/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Building, Trash2, Edit, DollarSign, TrendingUp, Filter } from 'lucide-react';
import type { Account } from '@/lib/supabase';
import { ProviderBadge } from '@/components/ui/provider-badge';
import { AccountSourceIndicator } from '@/components/ui/account-source-indicator';
import { useAccounts, useDeleteAccount } from '@/lib/hooks/use-accounts';
import { toast } from 'sonner';

type FilterType = 'all' | 'synced' | 'manual' | string; // string for provider name

export default function AccountsPage() {
  const router = useRouter();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  
  // Use React Query hook for accounts
  const { data: accounts = [], isLoading: loading, error } = useAccounts(currentTenant?.id);
  const deleteAccountMutation = useDeleteAccount();

  // Filter accounts based on selected filter (memoized for performance)
  const filteredAccounts = useMemo(() => {
    if (filter === 'all') {
      return accounts;
    } else if (filter === 'synced') {
      return accounts.filter(acc => acc.is_synced);
    } else if (filter === 'manual') {
      return accounts.filter(acc => !acc.is_synced);
    } else {
      // Filter by provider
      return accounts.filter(acc => acc.connection_provider === filter);
    }
  }, [accounts, filter]);

  // Show error toast if query fails
  useEffect(() => {
    if (error) {
      toast.error('Failed to load accounts', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [error]);

  async function handleDelete(accountId: string) {
    if (!currentTenant) return;
    if (!confirm('Are you sure you want to delete this account? This cannot be undone.')) {
      return;
    }

    deleteAccountMutation.mutate({
      accountId,
      tenantId: currentTenant.id,
    });
  }

  function getAccountTypeColor(type: string) {
    const colors: Record<string, string> = {
      checking: 'bg-blue-100 text-blue-800',
      savings: 'bg-green-100 text-green-800',
      money_market: 'bg-purple-100 text-purple-800',
      credit_card: 'bg-red-100 text-red-800',
      loan: 'bg-orange-100 text-orange-800',
      investment: 'bg-yellow-100 text-yellow-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  }

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      closed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status || 'active'] || 'bg-gray-100 text-gray-800';
  }

  function formatCurrency(amount: number | undefined, currency: string = 'USD') {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  if (!currentTenant) {
    return (
      <div className="flex h-screen">
        <Navigation />
        <main className="flex-1 overflow-y-auto bg-background p-8">
          <Card className="p-12 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4">No Organization Selected</h2>
            <p className="text-muted-foreground">
              Please select an organization from the sidebar.
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
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Accounts</h1>
              <p className="text-muted-foreground mt-2">
                Manage your bank accounts and financial accounts
              </p>
            </div>
            <Button
              onClick={() => router.push('/accounts/new')}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Account
            </Button>
          </div>

          {/* Filter Bar */}
          {!loading && accounts.length > 0 && (
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Filter:</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All ({accounts.length})
                </Button>
                <Button
                  variant={filter === 'synced' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('synced')}
                >
                  Synced ({accounts.filter(acc => acc.is_synced).length})
                </Button>
                <Button
                  variant={filter === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('manual')}
                >
                  Manual ({accounts.filter(acc => !acc.is_synced).length})
                </Button>
                {/* Provider filters */}
                {Array.from(new Set(accounts.map(acc => acc.connection_provider).filter(Boolean))).map((provider) => (
                  <Button
                    key={provider}
                    variant={filter === provider ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(provider!)}
                  >
                    {provider === 'tink' ? 'Tink' : provider === 'bunq' ? 'Bunq' : provider} ({accounts.filter(acc => acc.connection_provider === provider).length})
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <p>Loading accounts...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredAccounts.length === 0 && accounts.length === 0 && (
            <Card className="p-12 text-center">
              <div className="flex justify-center mb-4">
                <Building className="h-16 w-16 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">No accounts yet</h2>
              <p className="text-muted-foreground mb-6">
                Create your first account to start tracking transactions
              </p>
              <Button onClick={() => router.push('/accounts/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Account
              </Button>
            </Card>
          )}

          {/* Filtered Empty State */}
          {!loading && filteredAccounts.length === 0 && accounts.length > 0 && (
            <Card className="p-12 text-center">
              <div className="flex justify-center mb-4">
                <Filter className="h-16 w-16 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">No accounts match this filter</h2>
              <p className="text-muted-foreground mb-6">
                Try selecting a different filter or create a new account
              </p>
              <Button onClick={() => setFilter('all')}>
                Show All Accounts
              </Button>
            </Card>
          )}

          {/* Accounts Grid */}
          {!loading && filteredAccounts.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAccounts.map((account) => (
                <Card key={account.account_id || account.id} className="p-6 hover:shadow-lg transition-shadow">
                  {/* Provider and Source Badges */}
                  <div className="flex items-center gap-2 mb-3">
                    {account.connection_provider && (
                      <ProviderBadge
                        provider={account.connection_provider}
                        connectionName={account.connection_name}
                        connectionId={account.connection_id}
                        showLink={!!account.connection_id}
                      />
                    )}
                    <AccountSourceIndicator isSynced={!!account.connection_id} />
                  </div>

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Building className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold">{account.account_name}</h3>
                        {account.connection_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Via: {account.connection_name}
                          </p>
                        )}
                        {account.account_number && (
                          <p className="text-sm text-muted-foreground mt-1">
                            •••• {account.account_number.slice(-4)}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(account.account_id || account.id!)}
                      disabled={deleteAccountMutation.isPending}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Type</span>
                      <Badge className={getAccountTypeColor(account.account_type)}>
                        {account.account_type.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge className={getStatusColor(account.account_status || 'active')}>
                        {account.account_status || 'active'}
                      </Badge>
                    </div>

                    {account.bank_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Bank</span>
                        <span className="text-sm font-medium">{account.bank_name}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Currency</span>
                      <span className="text-sm font-medium">{account.currency || 'USD'}</span>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="border-t pt-4 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Balance</span>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-lg font-bold">
                          {formatCurrency(account.current_balance, account.currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/accounts/${account.account_id || account.id}`)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/accounts/${account.account_id || account.id}/transactions`)}
                      className="flex-1"
                    >
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Transactions
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

