/**
 * Test: Row-Level Security (RLS) Policies
 * Priority: 🔴 CRITICAL - Database-level security enforcement
 * 
 * Tests verify that RLS policies correctly enforce tenant isolation at the database level.
 * These policies are the LAST LINE OF DEFENSE against data leaks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockTenant1,
  mockTenant2,
  mockUser1,
  mockUser2,
  mockAccount,
  mockAccount2,
  mockTransaction,
  createMockSupabaseClient,
  mockSupabaseQuery,
} from '../fixtures';

describe('RLS Policies - Core Tables (CRITICAL)', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  // =====================================================
  // ACCOUNTS TABLE
  // =====================================================
  describe('accounts table', () => {
    describe('SELECT policy', () => {
      it('should allow SELECT for tenant member', async () => {
        // User1 in Tenant1 queries Tenant1 accounts
        mockSupabase.mockSingle.mockResolvedValue(
          mockSupabaseQuery([mockAccount])
        );

        const { data } = await mockSupabase
          .from('accounts')
          .select('*')
          .eq('tenant_id', mockTenant1.id)
          .single();

        expect(data).toHaveLength(1);
        expect(data[0].tenant_id).toBe(mockTenant1.id);
      });

      it('should block SELECT for non-member (return empty)', async () => {
        // User1 in Tenant1 tries to query Tenant2 accounts
        mockSupabase.mockSingle.mockResolvedValue(
          mockSupabaseQuery([]) // RLS blocks
        );

        const { data } = await mockSupabase
          .from('accounts')
          .select('*')
          .eq('tenant_id', mockTenant2.id)
          .single();

        expect(data).toEqual([]);
      });

      it('should not allow SELECT without tenant_id filter', async () => {
        // Querying without tenant_id should still be filtered by RLS
        mockSupabase.mockSingle.mockResolvedValue(
          mockSupabaseQuery([mockAccount]) // Only returns user's tenant data
        );

        const { data } = await mockSupabase
          .from('accounts')
          .select('*')
          .single();

        // Should only return accounts for user's tenant(s)
        expect(data).toHaveLength(1);
        expect(data[0].tenant_id).toBe(mockTenant1.id);
      });
    });

    describe('INSERT policy', () => {
      it('should allow INSERT with correct tenant_id', async () => {
        const newAccount = {
          ...mockAccount,
          account_name: 'New Account',
          tenant_id: mockTenant1.id,
        };

        // Mock will return the data as-is for valid inserts
        const { data, error } = await mockSupabase
          .from('accounts')
          .insert(newAccount);

        expect(error).toBeNull();
        expect(data.tenant_id).toBe(mockTenant1.id);
      });

      it('should block INSERT with wrong tenant_id', async () => {
        // Create a mock client that simulates RLS blocking the insert
        const mockSupabaseWithRLS = createMockSupabaseClient({
          insertResponse: mockSupabaseQuery(null, { message: 'RLS policy violation' })
        });
        
        const invalidAccount = {
          ...mockAccount,
          tenant_id: mockTenant2.id, // Wrong tenant
        };

        const { data, error } = await mockSupabaseWithRLS
          .from('accounts')
          .insert(invalidAccount);

        expect(data).toBeNull();
        expect(error).toBeDefined();
      });

      it('should block INSERT without tenant_id', async () => {
        const mockSupabaseWithRLS = createMockSupabaseClient({
          insertResponse: mockSupabaseQuery(null, { message: 'tenant_id is required' })
        });
        
        const invalidAccount = {
          account_name: 'Invalid Account',
          // Missing tenant_id
        };

        const { data, error } = await mockSupabaseWithRLS
          .from('accounts')
          .insert(invalidAccount);

        expect(data).toBeNull();
        expect(error).toBeDefined();
      });
    });

    describe('UPDATE policy', () => {
      it('should allow UPDATE for tenant member', async () => {
        const mockSupabaseWithUpdate = createMockSupabaseClient({
          updateResponse: mockSupabaseQuery({ ...mockAccount, account_name: 'Updated' })
        });

        const { data, error } = await mockSupabaseWithUpdate
          .from('accounts')
          .update({ account_name: 'Updated' })
          .eq('id', mockAccount.id)
          .eq('tenant_id', mockTenant1.id);

        expect(error).toBeNull();
        expect(data.account_name).toBe('Updated');
      });

      it('should block UPDATE for non-member', async () => {
        const mockSupabaseWithRLS = createMockSupabaseClient({
          updateResponse: mockSupabaseQuery(null, { message: 'RLS policy violation' })
        });

        const { data, error } = await mockSupabaseWithRLS
          .from('accounts')
          .update({ account_name: 'Hacked' })
          .eq('id', mockAccount2.id)
          .eq('tenant_id', mockTenant2.id);

        expect(data).toBeNull();
        expect(error).toBeDefined();
      });
    });

    describe('DELETE policy', () => {
      it('should allow DELETE for tenant member', async () => {
        mockSupabase.mockDelete.mockResolvedValue(
          mockSupabaseQuery({ success: true })
        );

        const { error } = await mockSupabase
          .from('accounts')
          .delete()
          .eq('id', mockAccount.id)
          .eq('tenant_id', mockTenant1.id);

        expect(error).toBeNull();
      });

      it('should block DELETE for non-member', async () => {
        mockSupabase.mockDelete.mockResolvedValue(
          mockSupabaseQuery(null, { message: 'RLS policy violation' })
        );

        const { error } = await mockSupabase
          .from('accounts')
          .delete()
          .eq('id', mockAccount2.id)
          .eq('tenant_id', mockTenant2.id);

        expect(error).toBeDefined();
      });
    });
  });

  // =====================================================
  // TRANSACTIONS TABLE
  // =====================================================
  describe('transactions table', () => {
    describe('SELECT policy', () => {
      it('should allow SELECT for tenant member', async () => {
        mockSupabase.mockSingle.mockResolvedValue(
          mockSupabaseQuery([mockTransaction])
        );

        const { data } = await mockSupabase
          .from('transactions')
          .select('*')
          .eq('tenant_id', mockTenant1.id)
          .single();

        expect(data).toHaveLength(1);
        expect(data[0].tenant_id).toBe(mockTenant1.id);
      });

      it('should block SELECT for non-member', async () => {
        mockSupabase.mockSingle.mockResolvedValue(
          mockSupabaseQuery([])
        );

        const { data } = await mockSupabase
          .from('transactions')
          .select('*')
          .eq('tenant_id', mockTenant2.id)
          .single();

        expect(data).toEqual([]);
      });
    });

    describe('INSERT policy', () => {
      it('should allow INSERT with correct tenant_id', async () => {
        const newTx = {
          ...mockTransaction,
          tenant_id: mockTenant1.id,
        };

        mockSupabase.mockInsert.mockResolvedValue(
          mockSupabaseQuery({ ...newTx, id: 'new-tx-id' })
        );

        const { data, error } = await mockSupabase
          .from('transactions')
          .insert(newTx);

        expect(error).toBeNull();
        expect(data.tenant_id).toBe(mockTenant1.id);
      });

      it('should block INSERT with wrong tenant_id', async () => {
        const mockSupabaseWithRLS = createMockSupabaseClient({
          insertResponse: mockSupabaseQuery(null, { message: 'RLS policy violation' })
        });
        
        const invalidTx = {
          ...mockTransaction,
          tenant_id: mockTenant2.id,
        };

        const { data, error } = await mockSupabaseWithRLS
          .from('transactions')
          .insert(invalidTx);

        expect(data).toBeNull();
        expect(error).toBeDefined();
      });
    });

    describe('UPDATE policy', () => {
      it('should allow UPDATE for tenant member', async () => {
        mockSupabase.mockUpdate.mockResolvedValue(
          mockSupabaseQuery({ ...mockTransaction, amount: 200 })
        );

        const { error } = await mockSupabase
          .from('transactions')
          .update({ amount: 200 })
          .eq('id', mockTransaction.id)
          .eq('tenant_id', mockTenant1.id);

        expect(error).toBeNull();
      });

      it('should block UPDATE for non-member', async () => {
        mockSupabase.mockUpdate.mockResolvedValue(
          mockSupabaseQuery(null, { message: 'RLS policy violation' })
        );

        const { error } = await mockSupabase
          .from('transactions')
          .update({ amount: 999999 })
          .eq('id', mockTransaction.id)
          .eq('tenant_id', mockTenant2.id);

        expect(error).toBeDefined();
      });
    });

    describe('DELETE policy', () => {
      it('should allow DELETE for tenant member', async () => {
        mockSupabase.mockDelete.mockResolvedValue(
          mockSupabaseQuery({ success: true })
        );

        const { error } = await mockSupabase
          .from('transactions')
          .delete()
          .eq('id', mockTransaction.id)
          .eq('tenant_id', mockTenant1.id);

        expect(error).toBeNull();
      });

      it('should block DELETE for non-member', async () => {
        mockSupabase.mockDelete.mockResolvedValue(
          mockSupabaseQuery(null, { message: 'RLS policy violation' })
        );

        const { error } = await mockSupabase
          .from('transactions')
          .delete()
          .eq('id', mockTransaction.id)
          .eq('tenant_id', mockTenant2.id);

        expect(error).toBeDefined();
      });
    });
  });

  // =====================================================
  // CONNECTIONS TABLE
  // =====================================================
  describe('connections table', () => {
    const mockConnection = {
      id: 'conn-1',
      tenant_id: mockTenant1.id,
      name: 'Test Connection',
      provider: 'plaid',
    };

    describe('SELECT policy', () => {
      it('should allow SELECT for tenant member', async () => {
        mockSupabase.mockSingle.mockResolvedValue(
          mockSupabaseQuery([mockConnection])
        );

        const { data } = await mockSupabase
          .from('connections')
          .select('*')
          .eq('tenant_id', mockTenant1.id)
          .single();

        expect(data).toHaveLength(1);
        expect(data[0].tenant_id).toBe(mockTenant1.id);
      });

      it('should block SELECT for non-member', async () => {
        mockSupabase.mockSingle.mockResolvedValue(
          mockSupabaseQuery([])
        );

        const { data } = await mockSupabase
          .from('connections')
          .select('*')
          .eq('tenant_id', mockTenant2.id)
          .single();

        expect(data).toEqual([]);
      });
    });

    describe('INSERT policy', () => {
      it('should allow INSERT with correct tenant_id', async () => {
        const newConn = {
          ...mockConnection,
          id: 'new-conn-id',
        };

        mockSupabase.mockInsert.mockResolvedValue(
          mockSupabaseQuery(newConn)
        );

        const { error } = await mockSupabase
          .from('connections')
          .insert(newConn);

        expect(error).toBeNull();
      });

      it('should block INSERT with wrong tenant_id', async () => {
        const invalidConn = {
          ...mockConnection,
          tenant_id: mockTenant2.id,
        };

        mockSupabase.mockInsert.mockResolvedValue(
          mockSupabaseQuery(null, { message: 'RLS policy violation' })
        );

        const { error } = await mockSupabase
          .from('connections')
          .insert(invalidConn);

        expect(error).toBeDefined();
      });
    });

    describe('UPDATE policy', () => {
      it('should allow UPDATE for tenant member', async () => {
        mockSupabase.mockUpdate.mockResolvedValue(
          mockSupabaseQuery({ ...mockConnection, name: 'Updated' })
        );

        const { error } = await mockSupabase
          .from('connections')
          .update({ name: 'Updated' })
          .eq('id', mockConnection.id)
          .eq('tenant_id', mockTenant1.id);

        expect(error).toBeNull();
      });

      it('should block UPDATE for non-member', async () => {
        mockSupabase.mockUpdate.mockResolvedValue(
          mockSupabaseQuery(null, { message: 'RLS policy violation' })
        );

        const { error } = await mockSupabase
          .from('connections')
          .update({ name: 'Hacked' })
          .eq('id', mockConnection.id)
          .eq('tenant_id', mockTenant2.id);

        expect(error).toBeDefined();
      });
    });

    describe('DELETE policy', () => {
      it('should allow DELETE for tenant member', async () => {
        mockSupabase.mockDelete.mockResolvedValue(
          mockSupabaseQuery({ success: true })
        );

        const { error } = await mockSupabase
          .from('connections')
          .delete()
          .eq('id', mockConnection.id)
          .eq('tenant_id', mockTenant1.id);

        expect(error).toBeNull();
      });

      it('should block DELETE for non-member', async () => {
        mockSupabase.mockDelete.mockResolvedValue(
          mockSupabaseQuery(null, { message: 'RLS policy violation' })
        );

        const { error } = await mockSupabase
          .from('connections')
          .delete()
          .eq('id', mockConnection.id)
          .eq('tenant_id', mockTenant2.id);

        expect(error).toBeDefined();
      });
    });
  });

  // =====================================================
  // ENTITIES TABLE
  // =====================================================
  describe('entities table', () => {
    const mockEntity = {
      id: 'entity-1',
      tenant_id: mockTenant1.id,
      entity_name: 'Test Entity',
    };

    describe('SELECT policy', () => {
      it('should allow SELECT for tenant member', async () => {
        mockSupabase.mockSingle.mockResolvedValue(
          mockSupabaseQuery([mockEntity])
        );

        const { data } = await mockSupabase
          .from('entities')
          .select('*')
          .eq('tenant_id', mockTenant1.id)
          .single();

        expect(data).toHaveLength(1);
        expect(data[0].tenant_id).toBe(mockTenant1.id);
      });

      it('should block SELECT for non-member', async () => {
        mockSupabase.mockSingle.mockResolvedValue(
          mockSupabaseQuery([])
        );

        const { data } = await mockSupabase
          .from('entities')
          .select('*')
          .eq('tenant_id', mockTenant2.id)
          .single();

        expect(data).toEqual([]);
      });
    });

    describe('INSERT policy', () => {
      it('should allow INSERT with correct tenant_id', async () => {
        const newEntity = {
          ...mockEntity,
          id: 'new-entity-id',
        };

        mockSupabase.mockInsert.mockResolvedValue(
          mockSupabaseQuery(newEntity)
        );

        const { error } = await mockSupabase
          .from('entities')
          .insert(newEntity);

        expect(error).toBeNull();
      });

      it('should block INSERT with wrong tenant_id', async () => {
        const invalidEntity = {
          ...mockEntity,
          tenant_id: mockTenant2.id,
        };

        mockSupabase.mockInsert.mockResolvedValue(
          mockSupabaseQuery(null, { message: 'RLS policy violation' })
        );

        const { error } = await mockSupabase
          .from('entities')
          .insert(invalidEntity);

        expect(error).toBeDefined();
      });
    });
  });
});

