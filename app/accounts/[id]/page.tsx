'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/auth-context';
import { Navigation } from '@/components/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EditAccountModal } from '@/components/EditAccountModal';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Pencil,
  Download,
  UploadCloud,
  Plus,
  BarChart3,
  ListOrdered,
  RefreshCw,
  Database,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import type { Account } from '@/lib/supabase';
import { accountKeys, useAccount } from '@/lib/hooks/use-accounts';
import { useAccountTransactions } from '@/lib/hooks/use-transactions';
import {
  useAccountStatements,
  useCreateStatement,
  useImportStatements,
  useImportTransactions,
} from '@/lib/hooks/use-statements';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function AccountOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const accountId = params.id as string;

  const [showEditModal, setShowEditModal] = useState(false);
  const [activeView, setActiveView] = useState<'combined' | 'chart'>('combined');
  const [transactionPage, setTransactionPage] = useState(1);
  const [showStatementForm, setShowStatementForm] = useState(false);
  const [statementForm, setStatementForm] = useState({
    date: new Date().toISOString().split('T')[0],
    endingBalance: '',
    availableBalance: '',
    currency: 'USD',
    notes: '',
  });

  const { data: account, isLoading } = useAccount(currentTenant?.id, accountId);
  const {
    data: transactionsData,
    isLoading: transactionsLoading,
  } = useAccountTransactions(currentTenant?.id, accountId, {
    page: transactionPage,
    pageSize: 50,
  });
  const {
    data: statementData,
    isLoading: statementsLoading,
  } = useAccountStatements(currentTenant?.id, accountId, { page: 1, pageSize: 90 });
  
  const createStatementMutation = useCreateStatement();

  const statements = statementData?.statements || [];
  const latestStatement = statements[0];
  
  const statementChartData = useMemo(() => {
    const rows = statementData?.statements || [];
    return [...rows]
      .sort(
        (a: any, b: any) =>
          new Date(a.statement_date).getTime() - new Date(b.statement_date).getTime()
      )
      .map((statement: any) => ({
        date: new Date(statement.statement_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        fullDate: statement.statement_date,
        balance: statement.ending_balance,
        available: statement.available_balance,
      }));
  }, [statementData?.statements]);

  const transactions = transactionsData?.transactions || [];

  const formatCurrencyValue = (value?: number | null, currency?: string | null) => {
    const safeCurrency = currency && currency.trim() !== '' ? currency : 'USD';
    const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits: 2,
    }).format(safeValue);
  };

  const handleStatementSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentTenant) return;

    const endingBalance = parseFloat(statementForm.endingBalance);
    if (Number.isNaN(endingBalance)) {
      toast.error('Ending balance is required');
      return;
    }

    const availableBalance =
      statementForm.availableBalance && statementForm.availableBalance !== ''
        ? parseFloat(statementForm.availableBalance)
        : undefined;

    createStatementMutation.mutate(
      {
        tenantId: currentTenant.id,
        accountId,
        statementDate: statementForm.date,
        endingBalance,
        availableBalance,
        currency: statementForm.currency,
        source: 'manual',
        confidence: 'medium',
        metadata: statementForm.notes ? { notes: statementForm.notes } : undefined,
      },
      {
        onSuccess: () => {
          setShowStatementForm(false);
          setStatementForm((prev) => ({
            ...prev,
            endingBalance: '',
            availableBalance: '',
            notes: '',
          }));
          toast.success('Statement added successfully');
        },
      }
    );
  };

  const handleDownloadStatements = () => {
    if (!account) return;
    if (!statements.length) {
      toast.info('No statements to export');
      return;
    }

    const header = 'statement_date,ending_balance,available_balance,currency,source,confidence\n';
    const rows = statements
      .map(
        (statement: any) =>
          `${statement.statement_date},${statement.ending_balance},${statement.available_balance ?? ''},${statement.currency},${statement.source},${statement.confidence}`
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${account.account_name || 'account'}-statements.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Navigation />
        <main className="flex-1 overflow-y-auto bg-background p-8">
          <div className="text-center py-12">Loading account…</div>
        </main>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex h-screen">
        <Navigation />
        <main className="flex-1 overflow-y-auto bg-background p-8">
          <Card className="p-12 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4">Account Not Found</h2>
            <Button onClick={() => router.push('/accounts')}>Back to Accounts</Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Navigation />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="sm" onClick={() => router.push('/accounts')}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </div>
              
              <h1 className="text-4xl font-bold">{account.account_name}</h1>
              
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span>{account.bank_name || 'Unspecified bank'}</span>
                <span>•</span>
                <span className="capitalize">{account.account_type}</span>
                {account.account_number && (
                  <>
                    <span>•</span>
                    <span className="font-mono">****{account.account_number.slice(-4)}</span>
                  </>
                )}
              </div>
              
              {/* Connection Info */}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {account.connection_id && (
                  <Link 
                    href={`/connections/${account.connection_id}`}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md"
                  >
                    <Database className="h-3 w-3" />
                    View Connection
                  </Link>
                )}
                {account.last_synced_at && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded-md">
                    <RefreshCw className="h-3 w-3" />
                    Synced {new Date(account.last_synced_at).toLocaleString()}
                  </div>
                )}
                {account.provider_id && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {account.provider_id}
                  </Badge>
                )}
              </div>

              {/* Current Balance - Large Display */}
              <div className="mt-6">
                <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
                <p className="text-5xl font-bold">
                  {formatCurrencyValue(
                    latestStatement?.ending_balance ?? account.current_balance ?? 0,
                    latestStatement?.currency || account.currency
                  )}
                </p>
                {latestStatement?.statement_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    As of {new Date(latestStatement.statement_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowEditModal(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Account
              </Button>
              <Button variant="outline" onClick={handleDownloadStatements} disabled={!statements.length}>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>

          {/* Balance Chart */}
          {statementChartData.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold">Balance History</h2>
                </div>
                <div className="text-sm text-muted-foreground">
                  Last {statementChartData.length} days
                </div>
              </div>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={statementChartData}>
                    <defs>
                      <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9ca3af"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '8px 12px',
                      }}
                      formatter={(value: number) =>
                        formatCurrencyValue(value, latestStatement?.currency || account.currency)
                      }
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return new Date(payload[0].payload.fullDate).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          });
                        }
                        return label;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      name="Balance"
                      stroke="#2563eb"
                      fill="url(#balanceGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Combined Activity & Statements */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <ListOrdered className="h-5 w-5" />
                  Activity & Statements
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Recent transactions and daily balance snapshots
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowStatementForm(!showStatementForm)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Statement
                </Button>
              </div>
            </div>

            {/* Add Statement Form */}
            {showStatementForm && (
              <form
                onSubmit={handleStatementSubmit}
                className="mb-6 p-4 rounded-lg border bg-muted/30"
              >
                <h3 className="font-semibold mb-3">Add Daily Balance Statement</h3>
                <div className="grid gap-4 md:grid-cols-5">
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <input
                      type="date"
                      className="w-full border rounded-lg px-3 py-2"
                      value={statementForm.date}
                      onChange={(e) => setStatementForm((prev) => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Ending Balance *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border rounded-lg px-3 py-2"
                      value={statementForm.endingBalance}
                      onChange={(e) =>
                        setStatementForm((prev) => ({ ...prev, endingBalance: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Available</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border rounded-lg px-3 py-2"
                      value={statementForm.availableBalance}
                      onChange={(e) =>
                        setStatementForm((prev) => ({ ...prev, availableBalance: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Currency</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg px-3 py-2"
                      value={statementForm.currency}
                      onChange={(e) =>
                        setStatementForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))
                      }
                      maxLength={3}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button type="submit" disabled={createStatementMutation.isPending} className="flex-1">
                      {createStatementMutation.isPending ? 'Saving…' : 'Save'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setShowStatementForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Combined Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b-2">
                  <tr className="text-left text-muted-foreground">
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Type</th>
                    <th className="py-3 px-4 font-medium">Description</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 text-right font-medium">Amount / Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionsLoading && statementsLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        Loading data…
                      </td>
                    </tr>
                  ) : (
                    <>
                      {/* Show statements as balance rows */}
                      {statements.slice(0, 10).map((statement: any) => (
                        <tr 
                          key={`stmt-${statement.id}`} 
                          className="border-b hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(statement.statement_date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              <Calendar className="h-3 w-3 mr-1" />
                              Statement
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            Daily balance snapshot ({statement.source})
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-xs capitalize">
                              {statement.confidence}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold">
                            {formatCurrencyValue(statement.ending_balance, statement.currency)}
                          </td>
                        </tr>
                      ))}

                      {/* Show transactions */}
                      {transactions.length === 0 && statements.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            No activity yet
                          </td>
                        </tr>
                      ) : (
                        transactions.map((tx) => (
                          <tr 
                            key={`tx-${tx.transaction_id}`} 
                            className="border-b hover:bg-muted/50 transition-colors"
                          >
                            <td className="py-3 px-4 text-muted-foreground">
                              {new Date(tx.date).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <Badge 
                                variant="outline" 
                                className={tx.amount >= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}
                              >
                                {tx.amount >= 0 ? 'Credit' : 'Debit'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">{tx.description}</td>
                            <td className="py-3 px-4">
                              {tx.category ? (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                  {tx.category}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-semibold ${
                                tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {tx.amount >= 0 ? '+' : ''}{formatCurrencyValue(tx.amount, tx.currency)}
                            </td>
                          </tr>
                        ))
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(transactions.length > 0 || statements.length > 0) && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {transactions.length} transactions and {Math.min(statements.length, 10)} statements
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTransactionPage((prev) => Math.max(prev - 1, 1))}
                    disabled={transactionPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTransactionPage((prev) => prev + 1)}
                    disabled={!transactionsData?.hasMore}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Edit Modal */}
      {showEditModal && (
        <EditAccountModal
          account={account}
          tenantId={currentTenant.id}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            queryClient.invalidateQueries({
              queryKey: accountKeys.detail(currentTenant.id, accountId),
            });
          }}
        />
      )}
    </div>
  );
}
