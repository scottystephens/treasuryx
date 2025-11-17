/**
 * Hook for fetching enriched transaction data
 * Combines normalized transactions with provider-specific metadata
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-client';

export interface EnrichedTransaction {
  // Standard transaction fields
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
  created_at: string;
  updated_at: string;
  
  // Additional transaction fields
  running_balance?: number;
  reference_number?: string;
  check_number?: string;
  counterparty_name?: string;
  counterparty_account?: string;
  bank_reference?: string;
  transaction_code?: string;
  memo?: string;
  sub_category?: string;
  merchant_name?: string;
  merchant_category_code?: string;
  location?: string;
  original_amount?: number;
  original_currency?: string;
  fee_amount?: number;
  tax_amount?: number;
  reconciliation_status?: string;
  
  // Provider information
  provider_id?: string;
  connection_id?: string;
  external_transaction_id?: string;
  provider_account_id?: string;
  
  // Provider-specific metadata (complete JSONB)
  provider_metadata?: Record<string, any>;
  
  // Extracted provider fields for easy access
  booking_status?: string;
  value_date?: string;
  original_date?: string;
  transaction_type_code?: string;
  provider_transaction_code?: string;
  category_id?: string;
  notes?: string;
  provider_status?: string;
  provider_merchant_category_code?: string;
  merchant_location?: string;
  provider_transaction_id?: string;
  
  // Import metadata
  provider_transaction_date?: string;
  provider_posted_date?: string;
  import_status?: string;
  import_job_id?: string;
  import_error?: string;
  
  // Flags
  is_provider_synced: boolean;
}

/**
 * Fetch enriched transactions for an account
 */
export function useEnrichedTransactions(accountId?: string) {
  return useQuery({
    queryKey: ['enriched-transactions', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('Account ID is required');
      
      const { data, error } = await supabase
        .from('transactions_enriched')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as EnrichedTransaction[];
    },
    enabled: !!accountId,
  });
}

/**
 * Fetch enriched transactions for multiple accounts
 */
export function useEnrichedTransactionsForAccounts(accountIds?: string[]) {
  return useQuery({
    queryKey: ['enriched-transactions-multi', accountIds],
    queryFn: async () => {
      if (!accountIds || accountIds.length === 0) {
        throw new Error('At least one account ID is required');
      }
      
      const { data, error } = await supabase
        .from('transactions_enriched')
        .select('*')
        .in('account_id', accountIds)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as EnrichedTransaction[];
    },
    enabled: !!accountIds && accountIds.length > 0,
  });
}

/**
 * Fetch a single enriched transaction by ID
 */
export function useEnrichedTransaction(transactionId?: string) {
  return useQuery({
    queryKey: ['enriched-transaction', transactionId],
    queryFn: async () => {
      if (!transactionId) throw new Error('Transaction ID is required');
      
      const { data, error } = await supabase
        .from('transactions_enriched')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

      if (error) throw error;
      return data as EnrichedTransaction;
    },
    enabled: !!transactionId,
  });
}

/**
 * Fetch enriched transactions with filters
 */
export interface TransactionFilters {
  accountIds?: string[];
  startDate?: string;
  endDate?: string;
  type?: string;
  category?: string;
  provider?: string;
  minAmount?: number;
  maxAmount?: number;
  bookingStatus?: string;
  searchQuery?: string;
}

export function useFilteredEnrichedTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ['enriched-transactions-filtered', filters],
    queryFn: async () => {
      let query = supabase
        .from('transactions_enriched')
        .select('*');

      // Apply filters
      if (filters.accountIds && filters.accountIds.length > 0) {
        query = query.in('account_id', filters.accountIds);
      }
      
      if (filters.startDate) {
        query = query.gte('date', filters.startDate);
      }
      
      if (filters.endDate) {
        query = query.lte('date', filters.endDate);
      }
      
      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters.provider) {
        query = query.eq('provider_id', filters.provider);
      }
      
      if (filters.minAmount !== undefined) {
        query = query.gte('amount', filters.minAmount);
      }
      
      if (filters.maxAmount !== undefined) {
        query = query.lte('amount', filters.maxAmount);
      }
      
      if (filters.bookingStatus) {
        query = query.eq('booking_status', filters.bookingStatus);
      }
      
      if (filters.searchQuery) {
        query = query.or(
          `description.ilike.%${filters.searchQuery}%,` +
          `counterparty_name.ilike.%${filters.searchQuery}%,` +
          `merchant_name.ilike.%${filters.searchQuery}%,` +
          `reference.ilike.%${filters.searchQuery}%`
        );
      }

      query = query.order('date', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as EnrichedTransaction[];
    },
    enabled: true,
  });
}

/**
 * Hook to invalidate enriched transaction cache
 */
export function useInvalidateEnrichedTransactions() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['enriched-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['enriched-transaction'] });
    queryClient.invalidateQueries({ queryKey: ['enriched-transactions-multi'] });
    queryClient.invalidateQueries({ queryKey: ['enriched-transactions-filtered'] });
  };
}

/**
 * Utility functions for working with enriched transactions
 */

export function isProviderSynced(transaction: EnrichedTransaction): boolean {
  return transaction.is_provider_synced === true;
}

export function isPending(transaction: EnrichedTransaction): boolean {
  return transaction.booking_status === 'PENDING';
}

export function hasValueDate(transaction: EnrichedTransaction): boolean {
  return !!transaction.value_date && transaction.value_date !== transaction.date;
}

export function getTransactionTypeLabel(transaction: EnrichedTransaction): string {
  if (transaction.transaction_type_code) {
    return transaction.transaction_type_code
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
  return transaction.type || 'Unknown';
}

export function getProviderStatusBadge(transaction: EnrichedTransaction): {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'destructive' | 'outline';
} {
  if (!transaction.is_provider_synced) {
    return { label: 'Manual', variant: 'outline' };
  }
  
  if (transaction.booking_status === 'PENDING') {
    return { label: 'Pending', variant: 'warning' };
  }
  
  if (transaction.booking_status === 'BOOKED') {
    return { label: 'Confirmed', variant: 'success' };
  }
  
  return { label: 'Synced', variant: 'default' };
}

export function formatTransactionDate(transaction: EnrichedTransaction): string {
  const date = new Date(transaction.date);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTransactionAmount(transaction: EnrichedTransaction): string {
  const amount = Math.abs(transaction.amount);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: transaction.currency || 'USD',
  }).format(amount);
  
  const sign = transaction.type === 'Credit' ? '+' : '-';
  return `${sign}${formatted}`;
}

/**
 * Export complete raw transaction data for debugging/audit
 */
export function getRawProviderData(transaction: EnrichedTransaction): any {
  return transaction.provider_metadata?.raw_transaction || null;
}

