import { useQuery } from '@tanstack/react-query';

/**
 * Query key factory for transactions
 */
export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (tenantId: string, accountId?: string) => 
    accountId 
      ? [...transactionKeys.lists(), tenantId, accountId] as const
      : [...transactionKeys.lists(), tenantId] as const,
};

export interface Transaction {
  transaction_id: string;
  account_id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  type: string;
  category?: string;
  reference?: string;
  counterparty_name?: string;
  metadata?: any;
}

/**
 * Fetch transactions for an account
 */
async function fetchAccountTransactions(
  tenantId: string,
  accountId: string,
  options?: { startDate?: string; endDate?: string; limit?: number }
): Promise<Transaction[]> {
  const params = new URLSearchParams({
    tenantId,
    ...(options?.startDate && { startDate: options.startDate }),
    ...(options?.endDate && { endDate: options.endDate }),
    ...(options?.limit && { limit: options.limit.toString() }),
  });
  
  const response = await fetch(`/api/accounts/${accountId}/transactions?${params.toString()}`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch transactions');
  }
  
  return data.transactions || [];
}

/**
 * Hook to fetch transactions for an account with caching
 */
export function useAccountTransactions(
  tenantId: string | undefined,
  accountId: string | undefined,
  options?: { startDate?: string; endDate?: string; limit?: number }
) {
  return useQuery({
    queryKey: [...transactionKeys.list(tenantId || '', accountId || ''), options],
    queryFn: () => fetchAccountTransactions(tenantId!, accountId!, options),
    enabled: !!tenantId && !!accountId,
    staleTime: 30 * 1000, // Transactions are fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

