import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Entity, CreateEntityInput, UpdateEntityInput } from '@/lib/types/entity';
import { toast } from 'sonner';

/**
 * Query key factory for entities
 */
export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (tenantId: string) => [...entityKeys.lists(), tenantId] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (tenantId: string, entityId: string) => [...entityKeys.details(), tenantId, entityId] as const,
};

/**
 * Fetch entities for a tenant
 */
async function fetchEntities(tenantId: string): Promise<Entity[]> {
  const response = await fetch(`/api/entities?tenantId=${tenantId}`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch entities');
  }
  
  return data.entities || [];
}

/**
 * Hook to fetch entities with caching
 */
export function useEntities(tenantId: string | undefined) {
  return useQuery({
    queryKey: entityKeys.list(tenantId || ''),
    queryFn: () => fetchEntities(tenantId!),
    enabled: !!tenantId,
    staleTime: 60 * 1000, // Entities are fresh for 1 minute
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to fetch a single entity
 */
export function useEntity(tenantId: string | undefined, entityId: string | undefined) {
  return useQuery({
    queryKey: entityKeys.detail(tenantId || '', entityId || ''),
    queryFn: async () => {
      const response = await fetch(`/api/entities?tenantId=${tenantId}&id=${entityId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch entity');
      }
      
      return data.entity;
    },
    enabled: !!tenantId && !!entityId,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to create an entity
 */
export function useCreateEntity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entity: CreateEntityInput) => {
      const response = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entity),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create entity');
      }
      
      return data.entity;
    },
    onSuccess: (_, variables) => {
      // Invalidate entities list
      queryClient.invalidateQueries({ queryKey: entityKeys.list(variables.tenant_id) });
      toast.success('Entity created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create entity', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

/**
 * Hook to update an entity
 */
export function useUpdateEntity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ entityId, tenantId, updates }: { entityId: string; tenantId: string; updates: UpdateEntityInput }) => {
      const response = await fetch('/api/entities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, tenantId, ...updates }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update entity');
      }
      
      return data.entity;
    },
    onSuccess: (_, variables) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey: entityKeys.list(variables.tenantId) });
      queryClient.invalidateQueries({ queryKey: entityKeys.detail(variables.tenantId, variables.entityId) });
      toast.success('Entity updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update entity', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

/**
 * Hook to delete an entity with optimistic updates
 */
export function useDeleteEntity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ entityId, tenantId }: { entityId: string; tenantId: string }) => {
      const response = await fetch(`/api/entities?id=${entityId}&tenantId=${tenantId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete entity');
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate entities list
      queryClient.invalidateQueries({ queryKey: entityKeys.list(variables.tenantId) });
      // Also invalidate accounts list as they might reference this entity
      queryClient.invalidateQueries({ queryKey: ['accounts', 'list', variables.tenantId] });
      toast.success('Entity deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete entity', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

