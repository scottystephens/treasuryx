import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { accountKeys } from './use-accounts';

/**
 * Hook to update account entity association
 */
export function useUpdateAccountEntity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      accountId,
      tenantId,
      entityId,
    }: {
      accountId: string;
      tenantId: string;
      entityId: string | null;
    }) => {
      const response = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          tenantId,
          entity_id: entityId,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update account entity');
      }
      
      return data.account;
    },
    onSuccess: (_, variables) => {
      // Invalidate accounts list and detail queries
      queryClient.invalidateQueries({ queryKey: accountKeys.list(variables.tenantId) });
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(variables.tenantId, variables.accountId) });
      // Also invalidate entities list as account count might change
      queryClient.invalidateQueries({ queryKey: ['entities', 'list', variables.tenantId] });
      
      toast.success('Account entity updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update account entity', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

