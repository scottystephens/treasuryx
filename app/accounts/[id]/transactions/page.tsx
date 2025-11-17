'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/auth-context';
import { Navigation } from '@/components/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Download,
  RefreshCw,
} from 'lucide-react';
import type { Account } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAccount } from '@/lib/hooks/use-accounts';
import { useAccountTransactions } from '@/lib/hooks/use-transactions';
import { useSyncConnection } from '@/lib/hooks/use-connections';

interface Transaction {
  transaction_id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: string;
  category?: string;
  status?: string;
  reference?: string;
  counterparty_name?: string;
  counterparty_account?: string;
  merchant_name?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export default function AccountTransactionsPage() {
  const router = useRouter();
  const params = useParams();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('30d');
  const [page, setPage] = useState(1);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 100;

  const accountId = params.id as string;

  // Calculate date range for query
  const dateRangeOptions = useMemo(() => {
    let startDate: string | undefined = undefined;
    const endDate = new Date().toISOString().split('T')[0];

    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const start = new Date();
      start.setDate(start.getDate() - days);
      startDate = start.toISOString().split('T')[0];
    }

    return { startDate, endDate };
  }, [dateRange]);

  // Use React Query hooks
  const { data: account, isLoading: accountLoading } = useAccount(currentTenant?.id, accountId);
  const {
    data: transactionsResponse,
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useAccountTransactions(
    currentTenant?.id,
    accountId,
    {
      ...dateRangeOptions,
      page,
      pageSize: PAGE_SIZE,
    }
  );
  const syncMutation = useSyncConnection();

  // Aggregate paginated transactions locally
  useEffect(() => {
    if (!transactionsResponse) return;

    setHasMore(transactionsResponse.hasMore);

    if (page === 1) {
      setAllTransactions(transactionsResponse.transactions);
      return;
    }

    setAllTransactions((prev) => {
      const existingIds = new Set(prev.map((tx) => tx.transaction_id));
      const merged = [...prev];
      transactionsResponse.transactions.forEach((tx) => {
        if (!existingIds.has(tx.transaction_id)) {
          merged.push(tx);
        }
      });
      return merged;
    });
  }, [transactionsResponse, page]);

  // Reset pagination when date range changes
  useEffect(() => {
    setPage(1);
    setAllTransactions([]);
  }, [dateRange]);

  useEffect(() => {
    setPage(1);
    setAllTransactions([]);
  }, [currentTenant?.id, accountId]);

  const transactions = allTransactions;

  const loading = accountLoading || transactionsLoading;

  async function handleSync() {
    if (!currentTenant || !account?.connection_id || !account.connection_provider) {
      toast.error('Account not connected', {
        description: 'This account is not connected to a banking provider',
      });
      return;
    }

    syncMutation.mutate({
      provider: account.connection_provider,
      connectionId: account.connection_id,
      tenantId: currentTenant.id,
      forceSync: true,
    }, {
      onSuccess: () => {
        toast.info('Sync started', {
          description: 'Transactions will appear shortly',
        });
        // Refetch transactions after sync completes
        setTimeout(() => {
          setPage(1);
          refetchTransactions();
        }, 2000);
      },
    });
  }

  function formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getTypeColor(type: string): string {
    if (type === 'Credit' || type === 'credit') {
      return 'text-green-600';
    }
    return 'text-red-600';
  }

  function getTypeIcon(type: string) {
    if (type === 'Credit' || type === 'credit') {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    }
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  }

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'credit') {
      return tx.type === 'Credit' || tx.type === 'credit';
    }
    if (filter === 'debit') {
      return tx.type === 'Debit' || tx.type === 'debit';
    }
    return true;
  });

  const totalCredits = transactions
    .filter((tx) => tx.type === 'Credit' || tx.type === 'credit')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const totalDebits = transactions
    .filter((tx) => tx.type === 'Debit' || tx.type === 'debit')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const netAmount = totalCredits - totalDebits;
  const showLoadMore = hasMore;

  if (tenantLoading) {
    return (
      <div className="flex h-screen">
        <Navigation />
        <main className="flex-1 overflow-y-auto bg-background p-8">
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
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
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push('/accounts')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Accounts
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">
                  {account?.account_name || 'Account Transactions'}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {account?.account_number && `•••• ${account.account_number.slice(-4)}`}
                  {account?.connection_provider && (
                    <span className="ml-2">
                      • Synced via {account.connection_provider}
                    </span>
                  )}
                </p>
              </div>
              {account?.connection_id && (
                <Button
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncMutation.isPending ? 'Syncing...' : 'Sync Transactions'}
                </Button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Total Credits</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalCredits, account?.currency)}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Total Debits</div>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalDebits, account?.currency)}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Net Amount</div>
              <div className={`text-2xl font-bold ${netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(netAmount, account?.currency)}
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4 mb-6">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter:</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All ({transactions.length})
                </Button>
                <Button
                  variant={filter === 'credit' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('credit')}
                >
                  Credits ({transactions.filter(tx => tx.type === 'Credit' || tx.type === 'credit').length})
                </Button>
                <Button
                  variant={filter === 'debit' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('debit')}
                >
                  Debits ({transactions.filter(tx => tx.type === 'Debit' || tx.type === 'debit').length})
                </Button>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Period:</span>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Transactions Table */}
          <Card>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading transactions...</p>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="p-12 text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
                  <p className="text-muted-foreground mb-4">
                    {account?.connection_id
                      ? 'Try syncing transactions from your bank account.'
                      : 'This account has no transactions yet.'}
                  </p>
                  {account?.connection_id && (
                    <Button onClick={handleSync} variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Transactions
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium">Date</th>
                      <th className="text-left p-4 font-medium">Description</th>
                      <th className="text-left p-4 font-medium">Category</th>
                      <th className="text-left p-4 font-medium">Reference</th>
                      <th className="text-left p-4 font-medium">Counterparty</th>
                      <th className="text-right p-4 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction) => (
                      <tr
                        key={transaction.transaction_id}
                        className="border-b hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4 text-sm text-muted-foreground">
                          {formatDate(transaction.date)}
                        </td>
                        <td className="p-4">
                          <div className="font-medium">{transaction.description}</div>
                          {transaction.merchant_name && (
                            <div className="text-xs text-muted-foreground">
                              {transaction.merchant_name}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          {transaction.category && (
                            <Badge variant="outline" className="text-xs">
                              {transaction.category}
                            </Badge>
                          )}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {transaction.reference || transaction.reference_number || '-'}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {transaction.counterparty_name || '-'}
                        </td>
                        <td className="p-4 text-right">
                          <div className={`font-semibold flex items-center justify-end gap-1 ${getTypeColor(transaction.type)}`}>
                            {getTypeIcon(transaction.type)}
                            {formatCurrency(
                              transaction.type === 'Credit' || transaction.type === 'credit'
                                ? Math.abs(transaction.amount)
                                : -Math.abs(transaction.amount),
                              transaction.currency
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!loading && showLoadMore && (
              <div className="p-4 text-center border-t">
                <Button
                  variant="outline"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={transactionsLoading}
                >
                  {transactionsLoading ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

