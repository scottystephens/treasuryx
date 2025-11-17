/**
 * Enhanced Transaction Table Component
 * Displays transactions with provider-specific fields like booking status, transaction type, etc.
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  CreditCard,
  ArrowRightLeft,
  Wallet,
  Info,
} from 'lucide-react';
import type { EnrichedTransaction } from '@/lib/hooks/use-enriched-transactions';
import { useRouter } from 'next/navigation';

interface EnhancedTransactionTableProps {
  transactions: EnrichedTransaction[];
  showProviderFields?: boolean;
  onTransactionClick?: (transactionId: string) => void;
}

export function EnhancedTransactionTable({
  transactions,
  showProviderFields = true,
  onTransactionClick,
}: EnhancedTransactionTableProps) {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(Math.abs(amount));
  };

  const getTypeColor = (type: string) => {
    return type === 'Credit' || type === 'credit'
      ? 'text-green-600'
      : 'text-red-600';
  };

  const getTypeIcon = (type: string) => {
    return type === 'Credit' || type === 'credit' ? (
      <TrendingUp className="h-4 w-4" />
    ) : (
      <TrendingDown className="h-4 w-4" />
    );
  };

  // Get booking status badge
  const getBookingStatusBadge = (transaction: EnrichedTransaction) => {
    if (!transaction.is_provider_synced) {
      return (
        <Badge variant="outline" className="text-xs">
          Manual
        </Badge>
      );
    }

    if (transaction.booking_status === 'PENDING') {
      return (
        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    }

    if (transaction.booking_status === 'BOOKED') {
      return (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Confirmed
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-xs">
        Synced
      </Badge>
    );
  };

  // Get transaction type icon
  const getTransactionTypeIcon = (typeCode?: string) => {
    if (!typeCode) return null;

    const iconMap: Record<string, React.ReactNode> = {
      CARD_PAYMENT: <CreditCard className="h-3 w-3" />,
      CARD: <CreditCard className="h-3 w-3" />,
      TRANSFER: <ArrowRightLeft className="h-3 w-3" />,
      DIRECT_DEBIT: <Wallet className="h-3 w-3" />,
      ATM_WITHDRAWAL: <Wallet className="h-3 w-3" />,
    };

    return iconMap[typeCode] || <ArrowRightLeft className="h-3 w-3" />;
  };

  // Format transaction type for display
  const formatTransactionType = (typeCode?: string) => {
    if (!typeCode) return null;

    return typeCode
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const handleRowClick = (transactionId: string) => {
    if (onTransactionClick) {
      onTransactionClick(transactionId);
    } else {
      // Default behavior: navigate to transaction detail page
      const accountId = transactions[0]?.account_id;
      if (accountId) {
        router.push(`/accounts/${accountId}/transactions/${transactionId}`);
      }
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="text-left p-4 font-medium">Date</th>
            {showProviderFields && (
              <th className="text-left p-4 font-medium">Status</th>
            )}
            <th className="text-left p-4 font-medium">Description</th>
            {showProviderFields && (
              <th className="text-left p-4 font-medium">Type</th>
            )}
            <th className="text-left p-4 font-medium">Category</th>
            <th className="text-left p-4 font-medium">Reference</th>
            <th className="text-right p-4 font-medium">Amount</th>
            <th className="text-center p-4 font-medium w-10"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr
              key={transaction.transaction_id}
              className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => handleRowClick(transaction.transaction_id)}
            >
              {/* Date */}
              <td className="p-4">
                <div className="text-sm text-muted-foreground">
                  {formatDate(transaction.date)}
                </div>
                {/* Show value date if different from booking date */}
                {showProviderFields &&
                  transaction.value_date &&
                  transaction.value_date !== transaction.date && (
                    <div className="text-xs text-muted-foreground">
                      Value: {formatDate(transaction.value_date)}
                    </div>
                  )}
              </td>

              {/* Booking Status */}
              {showProviderFields && (
                <td className="p-4">
                  {getBookingStatusBadge(transaction)}
                </td>
              )}

              {/* Description */}
              <td className="p-4">
                <div className="font-medium">{transaction.description}</div>
                {/* Merchant name or counterparty */}
                {(transaction.merchant_name || transaction.counterparty_name) && (
                  <div className="text-xs text-muted-foreground">
                    {transaction.merchant_name || transaction.counterparty_name}
                  </div>
                )}
                {/* Notes from provider */}
                {showProviderFields && transaction.notes && (
                  <div className="text-xs text-muted-foreground italic mt-1">
                    {transaction.notes}
                  </div>
                )}
              </td>

              {/* Transaction Type */}
              {showProviderFields && (
                <td className="p-4">
                  {transaction.transaction_type_code ? (
                    <Badge variant="outline" className="text-xs flex items-center gap-1 w-fit">
                      {getTransactionTypeIcon(transaction.transaction_type_code)}
                      {formatTransactionType(transaction.transaction_type_code)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
              )}

              {/* Category */}
              <td className="p-4">
                {transaction.category ? (
                  <Badge variant="outline" className="text-xs">
                    {transaction.category}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </td>

              {/* Reference */}
              <td className="p-4 text-sm text-muted-foreground">
                {transaction.reference || transaction.reference_number || '-'}
              </td>

              {/* Amount */}
              <td className="p-4 text-right">
                <div
                  className={`font-semibold flex items-center justify-end gap-1 ${getTypeColor(
                    transaction.type
                  )}`}
                >
                  {getTypeIcon(transaction.type)}
                  {formatCurrency(transaction.amount, transaction.currency)}
                </div>
              </td>

              {/* Info icon */}
              <td className="p-4 text-center">
                {transaction.is_provider_synced && (
                  <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {transactions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No transactions found</p>
        </div>
      )}
    </div>
  );
}

/**
 * Transaction Filter Component
 * Filters for enriched transactions including provider-specific fields
 */

import { useState, useEffect } from 'react';

export function TransactionFilters({
  onFilterChange,
  showProviderFilters = true,
}: {
  onFilterChange: (filters: any) => void;
  showProviderFilters?: boolean;
}) {
  const [type, setType] = useState<'all' | 'credit' | 'debit'>('all');
  const [bookingStatus, setBookingStatus] = useState<'all' | 'BOOKED' | 'PENDING'>('all');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Apply filters whenever they change
  useEffect(() => {
    const filters: any = {};

    if (type !== 'all') {
      filters.type = type === 'credit' ? 'Credit' : 'Debit';
    }

    if (bookingStatus !== 'all') {
      filters.bookingStatus = bookingStatus;
    }

    // Calculate date range
    if (dateRange !== 'all') {
      const endDate = new Date();
      const startDate = new Date();

      if (dateRange === '7d') startDate.setDate(endDate.getDate() - 7);
      else if (dateRange === '30d') startDate.setDate(endDate.getDate() - 30);
      else if (dateRange === '90d') startDate.setDate(endDate.getDate() - 90);

      filters.startDate = startDate.toISOString().split('T')[0];
      filters.endDate = endDate.toISOString().split('T')[0];
    }

    onFilterChange(filters);
  }, [type, bookingStatus, dateRange, onFilterChange]);

  return (
    <div className="flex flex-wrap gap-4 items-center">
      {/* Type filter */}
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-2 block">
          Type
        </label>
        <div className="flex gap-2">
          <Button
            variant={type === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setType('all')}
          >
            All
          </Button>
          <Button
            variant={type === 'credit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setType('credit')}
          >
            Credit
          </Button>
          <Button
            variant={type === 'debit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setType('debit')}
          >
            Debit
          </Button>
        </div>
      </div>

      {/* Booking status filter (provider-specific) */}
      {showProviderFilters && (
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Status
          </label>
          <div className="flex gap-2">
            <Button
              variant={bookingStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBookingStatus('all')}
            >
              All
            </Button>
            <Button
              variant={bookingStatus === 'BOOKED' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBookingStatus('BOOKED')}
            >
              Confirmed
            </Button>
            <Button
              variant={bookingStatus === 'PENDING' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBookingStatus('PENDING')}
            >
              Pending
            </Button>
          </div>
        </div>
      )}

      {/* Date range filter */}
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-2 block">
          Date Range
        </label>
        <div className="flex gap-2">
          <Button
            variant={dateRange === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('7d')}
          >
            7 days
          </Button>
          <Button
            variant={dateRange === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('30d')}
          >
            30 days
          </Button>
          <Button
            variant={dateRange === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('90d')}
          >
            90 days
          </Button>
          <Button
            variant={dateRange === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('all')}
          >
            All
          </Button>
        </div>
      </div>
    </div>
  );
}

