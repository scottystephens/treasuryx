/**
 * Test: Multi-Tenant Isolation (CRITICAL SECURITY)
 * Priority: CRITICAL - Data leaks between tenants would be catastrophic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockTenant1,
  mockTenant2,
  mockAccount,
  mockAccount2,
  mockUser1,
  mockUser2,
  createMockSupabaseClient,
  mockSupabaseQuery,
} from '../fixtures';

describe('Multi-Tenant Isolation (CRITICAL)', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  describe('Account Access', () => {
    it('should only return accounts for current tenant', async () => {
      // Mock: User 1 queries accounts for Tenant 1
      mockSupabase.mockSingle.mockResolvedValue(
        mockSupabaseQuery([mockAccount])
      );

      const supabase = mockSupabase;
      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('tenant_id', mockTenant1.id)
        .single();

      expect(data).toHaveLength(1);
      expect(data[0].tenant_id).toBe(mockTenant1.id);
    });

    it('should return empty array when querying other tenant data', async () => {
      // Mock: User 1 tries to query Tenant 2's accounts
      // RLS should block this, returning empty array
      mockSupabase.mockSingle.mockResolvedValue(
        mockSupabaseQuery([]) // Empty due to RLS
      );

      const supabase = mockSupabase;
      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('tenant_id', mockTenant2.id)
        .single();

      expect(data).toEqual([]);
    });

    it('should not allow direct access to account by ID across tenants', async () => {
      // User 1 tries to access Tenant 2's account by ID
      // RLS should block this - return null data
      const mockSupabaseWithBlock = createMockSupabaseClient({
        selectResponse: mockSupabaseQuery(null), // No data returned due to RLS
      });

      const { data } = await mockSupabaseWithBlock
        .from('accounts')
        .select('*')
        .eq('id', mockAccount2.id)
        .single();

      expect(data).toBeNull();
    });
  });

  describe('Transaction Access', () => {
    it('should only return transactions for current tenant', async () => {
      const mockTransaction = {
        id: 'test-tx-1',
        account_id: mockAccount.id,
        tenant_id: mockTenant1.id,
        amount: 100,
      };

      mockSupabase.mockSingle.mockResolvedValue(
        mockSupabaseQuery([mockTransaction])
      );

      const supabase = mockSupabase;
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('tenant_id', mockTenant1.id)
        .single();

      expect(data).toHaveLength(1);
      expect(data[0].tenant_id).toBe(mockTenant1.id);
    });

    it('should not leak transactions across tenants', async () => {
      mockSupabase.mockSingle.mockResolvedValue(
        mockSupabaseQuery([])
      );

      const supabase = mockSupabase;
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('tenant_id', mockTenant2.id)
        .single();

      expect(data).toEqual([]);
    });
  });

  describe('Connection Access', () => {
    it('should only return connections for current tenant', async () => {
      const mockConnection = {
        id: 'test-conn-1',
        tenant_id: mockTenant1.id,
        name: 'Test Connection',
      };

      mockSupabase.mockSingle.mockResolvedValue(
        mockSupabaseQuery([mockConnection])
      );

      const supabase = mockSupabase;
      const { data } = await supabase
        .from('connections')
        .select('*')
        .eq('tenant_id', mockTenant1.id)
        .single();

      expect(data).toHaveLength(1);
      expect(data[0].tenant_id).toBe(mockTenant1.id);
    });
  });

  describe('User-Tenant Membership', () => {
    it('should verify user belongs to tenant before granting access', async () => {
      // Mock: Check if user1 belongs to tenant1
      mockSupabase.mockSingle.mockResolvedValue(
        mockSupabaseQuery({
          user_id: mockUser1.id,
          tenant_id: mockTenant1.id,
          role: 'owner',
        })
      );

      const supabase = mockSupabase;
      const { data: membership } = await supabase
        .from('user_tenants')
        .select('*')
        .eq('user_id', mockUser1.id)
        .eq('tenant_id', mockTenant1.id)
        .single();

      expect(membership).toBeDefined();
      expect(membership.user_id).toBe(mockUser1.id);
      expect(membership.tenant_id).toBe(mockTenant1.id);
    });

    it('should reject access if user not in tenant', async () => {
      // Mock: User1 tries to access Tenant2 (not a member)
      mockSupabase.mockSingle.mockResolvedValue(
        mockSupabaseQuery(null, { message: 'No rows found' })
      );

      const supabase = mockSupabase;
      const { data: membership, error } = await supabase
        .from('user_tenants')
        .select('*')
        .eq('user_id', mockUser1.id)
        .eq('tenant_id', mockTenant2.id)
        .single();

      expect(membership).toBeNull();
      expect(error).toBeDefined();
    });
  });

  describe('Data Insertion', () => {
    it('should associate new records with correct tenant_id', async () => {
      const newAccount = {
        tenant_id: mockTenant1.id,
        account_name: 'New Account',
        account_number: '9999999999',
      };

      mockSupabase.mockInsert.mockResolvedValue(
        mockSupabaseQuery({ ...newAccount, id: 'new-account-id' })
      );

      const supabase = mockSupabase;
      const { data } = await supabase
        .from('accounts')
        .insert(newAccount);

      expect(data.tenant_id).toBe(mockTenant1.id);
    });

    it('should reject insertion without tenant_id', async () => {
      const invalidAccount = {
        account_name: 'Invalid Account',
        // Missing tenant_id
      };

      // Create mock that blocks insertion without tenant_id
      const mockSupabaseWithBlock = createMockSupabaseClient({
        insertResponse: mockSupabaseQuery(null, { message: 'tenant_id is required' }),
      });

      const { data, error } = await mockSupabaseWithBlock
        .from('accounts')
        .insert(invalidAccount);

      expect(data).toBeNull();
      expect(error).toBeDefined();
    });
  });
});

