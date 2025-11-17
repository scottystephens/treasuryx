import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Account } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * Query key factory for accounts
 */
export const accountKeys = {
  all: ['accounts'] as const,
  lists: () => [...accountKeys.all, 'list'] as const,
  list: (tenantId: string) => [...accountKeys.lists(), tenantId] as const,
  details: () => [...accountKeys.all, 'detail'] as const,
  detail: (tenantId: string, accountId: string) => [...accountKeys.details(), tenantId, accountId] as const,
};

/**
 * Fetch accounts for a tenant
 */
async function fetchAccounts(tenantId: string): Promise<Account[]> {
  const response = await fetch(`/api/accounts?tenantId=${tenantId}`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch accounts');
  }
  
  return data.accounts || [];
}

/**
 * Hook to fetch accounts with caching
 */
export function useAccounts(tenantId: string | undefined) {
  return useQuery({
    queryKey: accountKeys.list(tenantId || ''),
    queryFn: () => fetchAccounts(tenantId!),
    enabled: !!tenantId,
    staleTime: 60 * 1000, // Accounts are fresh for 1 minute
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to fetch a single account
 */
export function useAccount(tenantId: string | undefined, accountId: string | undefined) {
  return useQuery({
    queryKey: accountKeys.detail(tenantId || '', accountId || ''),
    queryFn: async () => {
      const response = await fetch(`/api/accounts?tenantId=${tenantId}&id=${accountId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch account');
      }
      
      return data.account;
    },
    enabled: !!tenantId && !!accountId,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to delete an account with optimistic updates
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ accountId, tenantId }: { accountId: string; tenantId: string }) => {
      const response = await fetch(`/api/accounts?id=${accountId}&tenantId=${tenantId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate accounts list
      queryClient.invalidateQueries({ queryKey: accountKeys.list(variables.tenantId) });
      toast.success('Account deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete account', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

