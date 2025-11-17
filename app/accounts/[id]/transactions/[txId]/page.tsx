/**
 * Transaction Detail Page
 * Shows complete transaction information including full provider-specific metadata
 */

'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  CreditCard,
  Calendar,
  Tag,
  FileText,
  Code,
  Building,
  MapPin,
} from 'lucide-react';
import { useEnrichedTransaction } from '@/lib/hooks/use-enriched-transactions';

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string; txId: string }>;
}) {
  const { id: accountId, txId } = use(params);
  const router = useRouter();
  
  const { data: transaction, isLoading, error } = useEnrichedTransaction(txId);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(Math.abs(amount));
    const sign = amount >= 0 ? '+' : '-';
    return `${sign}${formatted}`;
  };

  if (isLoading) {
    return (
      <div>
        <Navigation />
        <main className="min-h-screen bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div>
        <Navigation />
        <main className="min-h-screen bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                {error ? 'Error loading transaction' : 'Transaction not found'}
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => router.push(`/accounts/${accountId}/transactions`)}
              >
                Back to Transactions
              </Button>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const getTypeIcon = () => {
    return transaction.type === 'Credit' || transaction.type === 'credit' ? (
      <TrendingUp className="h-6 w-6 text-green-600" />
    ) : (
      <TrendingDown className="h-6 w-6 text-red-600" />
    );
  };

  const getTypeColor = () => {
    return transaction.type === 'Credit' || transaction.type === 'credit'
      ? 'text-green-600'
      : 'text-red-600';
  };

  return (
    <div>
      <Navigation />
      <main className="min-h-screen bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/accounts/${accountId}/transactions`)}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Transactions
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">{transaction.description}</h1>
                <p className="text-muted-foreground">
                  {formatDate(transaction.date)} at {formatTime(transaction.date)}
                </p>
              </div>
              <div className={`text-4xl font-bold ${getTypeColor()} flex items-center gap-2`}>
                {getTypeIcon()}
                {formatCurrency(transaction.amount, transaction.currency)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Overview Card */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Overview</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{formatDate(transaction.date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className={`font-medium ${getTypeColor()}`}>
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium">
                      {transaction.category ? (
                        <Badge variant="outline">{transaction.category}</Badge>
                      ) : (
                        '-'
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">
                      {transaction.booking_status === 'PENDING' ? (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      ) : transaction.booking_status === 'BOOKED' ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Confirmed
                        </Badge>
                      ) : (
                        <Badge>{transaction.status || 'Completed'}</Badge>
                      )}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Provider-Specific Details */}
              {transaction.is_provider_synced && (
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Bank Provider Details
                  </h2>
                  <div className="space-y-4">
                    {transaction.transaction_type_code && (
                      <div>
                        <p className="text-sm text-muted-foreground">Transaction Type</p>
                        <p className="font-medium flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          {transaction.transaction_type_code.replace(/_/g, ' ')}
                        </p>
                      </div>
                    )}

                    {transaction.value_date && transaction.value_date !== transaction.date && (
                      <div>
                        <p className="text-sm text-muted-foreground">Value Date</p>
                        <p className="font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formatDate(transaction.value_date)}
                          <span className="text-xs text-muted-foreground">
                            (when money actually moved)
                          </span>
                        </p>
                      </div>
                    )}

                    {transaction.provider_transaction_code && (
                      <div>
                        <p className="text-sm text-muted-foreground">Transaction Code</p>
                        <p className="font-medium font-mono text-sm flex items-center gap-2">
                          <Code className="h-4 w-4" />
                          {transaction.provider_transaction_code}
                        </p>
                      </div>
                    )}

                    {transaction.notes && (
                      <div>
                        <p className="text-sm text-muted-foreground">Notes</p>
                        <p className="font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {transaction.notes}
                        </p>
                      </div>
                    )}

                    {transaction.merchant_location && (
                      <div>
                        <p className="text-sm text-muted-foreground">Location</p>
                        <p className="font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {transaction.merchant_location}
                        </p>
                      </div>
                    )}

                    {transaction.merchant_category_code && (
                      <div>
                        <p className="text-sm text-muted-foreground">Merchant Category Code</p>
                        <p className="font-medium font-mono text-sm">
                          {transaction.merchant_category_code}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Counterparty Information */}
              {(transaction.counterparty_name || transaction.merchant_name) && (
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Counterparty</h2>
                  <div className="space-y-3">
                    {(transaction.merchant_name || transaction.counterparty_name) && (
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">
                          {transaction.merchant_name || transaction.counterparty_name}
                        </p>
                      </div>
                    )}
                    {transaction.counterparty_account && (
                      <div>
                        <p className="text-sm text-muted-foreground">Account</p>
                        <p className="font-medium font-mono text-sm">
                          {transaction.counterparty_account}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Reference Information */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Reference
                </h2>
                <div className="space-y-3">
                  {(transaction.reference || transaction.reference_number) && (
                    <div>
                      <p className="text-sm text-muted-foreground">Reference Number</p>
                      <p className="font-medium font-mono text-sm">
                        {transaction.reference || transaction.reference_number}
                      </p>
                    </div>
                  )}
                  {transaction.external_transaction_id && (
                    <div>
                      <p className="text-sm text-muted-foreground">External ID</p>
                      <p className="font-medium font-mono text-xs break-all">
                        {transaction.external_transaction_id}
                      </p>
                    </div>
                  )}
                  {transaction.transaction_id && (
                    <div>
                      <p className="text-sm text-muted-foreground">Transaction ID</p>
                      <p className="font-medium font-mono text-xs break-all">
                        {transaction.transaction_id}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Import Information */}
              {transaction.is_provider_synced && (
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Import Details</h2>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Source</p>
                      <p className="font-medium capitalize">
                        {transaction.provider_id || 'Manual'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Import Status</p>
                      <Badge variant="outline">
                        {transaction.import_status || 'imported'}
                      </Badge>
                    </div>
                    {transaction.created_at && (
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="text-sm">
                          {formatDate(transaction.created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Raw Provider Data (for debugging) */}
              {transaction.provider_metadata && process.env.NODE_ENV === 'development' && (
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Raw Provider Data</h2>
                  <details>
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      View JSON
                    </summary>
                    <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                      {JSON.stringify(transaction.provider_metadata, null, 2)}
                    </pre>
                  </details>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

