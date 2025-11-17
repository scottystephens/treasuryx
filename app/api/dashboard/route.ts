import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getAccountsByTenant, getTransactionsByTenant, getEntitiesByTenant } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    // Get user from server-side client
    const supabaseClient = await createClient();
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant ID and filters from query params
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const dateRange = searchParams.get('dateRange') || '7d';
    const transactionType = searchParams.get('transactionType') || 'all';
    const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean) || [];
    const entityIds = searchParams.get('entityIds')?.split(',').filter(Boolean) || [];
    const currencies = searchParams.get('currencies')?.split(',').filter(Boolean) || [];

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Fetch all data in parallel
    let [accounts, transactions, entities] = await Promise.all([
      getAccountsByTenant(tenantId, false),
      getTransactionsByTenant(tenantId, 1000), // Get more transactions for filtering
      getEntitiesByTenant(tenantId),
    ]);

    // Apply filters
    // Filter accounts
    if (accountIds.length > 0) {
      accounts = accounts.filter(acc => 
        accountIds.includes(acc.account_id || acc.id || '')
      );
    }
    if (entityIds.length > 0) {
      accounts = accounts.filter(acc => 
        acc.entity_id && entityIds.includes(acc.entity_id)
      );
    }
    if (currencies.length > 0) {
      accounts = accounts.filter(acc => 
        currencies.includes(acc.currency || 'USD')
      );
    }

    // Filter transactions by date range
    let dateFilterStart: Date | null = null;
    if (dateRange !== 'all') {
      const now = new Date();
      switch (dateRange) {
        case '7d':
          dateFilterStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          dateFilterStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          dateFilterStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          dateFilterStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    // Filter transactions
    if (dateFilterStart) {
      transactions = transactions.filter(t => {
        const txnDate = new Date(t.date);
        return txnDate >= dateFilterStart!;
      });
    }
    if (accountIds.length > 0) {
      transactions = transactions.filter(t => 
        accountIds.includes(t.account_id)
      );
    }
    if (transactionType === 'credit') {
      transactions = transactions.filter(t => t.amount > 0);
    } else if (transactionType === 'debit') {
      transactions = transactions.filter(t => t.amount < 0);
    }

    // Process custom filters
    const customFilterParams: Array<{ field: string; operator: string; value: string }> = [];
    searchParams.forEach((value, key) => {
      const match = key.match(/^customFilter\[(\d+)\]\[(\w+)\]$/);
      if (match) {
        const index = parseInt(match[1]);
        const field = match[2];
        if (!customFilterParams[index]) {
          customFilterParams[index] = { field: '', operator: '', value: '' };
        }
        if (field === 'field') {
          customFilterParams[index].field = value;
        } else if (field === 'operator') {
          customFilterParams[index].operator = value;
        } else if (field === 'value') {
          customFilterParams[index].value = value;
        }
      }
    });

    // Apply custom filters to transactions
    customFilterParams.forEach(filter => {
      if (!filter.field || !filter.value) return;

      switch (filter.field) {
        case 'category':
          if (filter.operator === 'equals') {
            transactions = transactions.filter(t => t.category === filter.value);
          } else if (filter.operator === 'contains') {
            transactions = transactions.filter(t => 
              t.category?.toLowerCase().includes(filter.value.toLowerCase())
            );
          }
          break;
        case 'status':
          if (filter.operator === 'equals') {
            transactions = transactions.filter(t => t.status === filter.value);
          }
          break;
        case 'description':
          if (filter.operator === 'contains') {
            transactions = transactions.filter(t => 
              t.description?.toLowerCase().includes(filter.value.toLowerCase())
            );
          }
          break;
        case 'min_amount':
          const minAmount = parseFloat(filter.value);
          if (!isNaN(minAmount)) {
            transactions = transactions.filter(t => Math.abs(t.amount) >= minAmount);
          }
          break;
        case 'max_amount':
          const maxAmount = parseFloat(filter.value);
          if (!isNaN(maxAmount)) {
            transactions = transactions.filter(t => Math.abs(t.amount) <= maxAmount);
          }
          break;
      }
    });

    // Apply custom filters to accounts
    customFilterParams.forEach(filter => {
      if (!filter.field || !filter.value) return;

      switch (filter.field) {
        case 'account_type':
          if (filter.operator === 'equals') {
            accounts = accounts.filter(acc => acc.account_type === filter.value);
          }
          break;
        case 'account_status':
          if (filter.operator === 'equals') {
            accounts = accounts.filter(acc => acc.account_status === filter.value);
          }
          break;
      }
    });

    // Calculate total cash position (sum of all account balances)
    const totalCashUSD = accounts.reduce((sum, account) => {
      const balance = account.balance ?? account.current_balance ?? account.available_balance ?? 0;
      // For now, assume all balances are in their native currency
      // TODO: Add currency conversion when exchange rates are available
      return sum + balance;
    }, 0);

    // Calculate cash flow based on date range
    const cashFlowStartDate = dateFilterStart || (() => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return sevenDaysAgo;
    })();

    const recentTransactions = transactions.filter(t => {
      const txnDate = new Date(t.date);
      return txnDate >= cashFlowStartDate;
    });

    const inflows = recentTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const outflows = recentTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const netCashFlow = inflows - outflows;

    // Get recent transactions (last 5)
    const recentTransactionsList = transactions
      .slice(0, 5)
      .map(t => ({
        transaction_id: t.transaction_id,
        date: t.date,
        description: t.description || 'No description',
        amount: t.amount,
        currency: t.currency || 'USD',
        type: t.amount >= 0 ? 'Credit' : 'Debit',
        category: t.category || 'Uncategorized',
        status: t.status || 'Completed',
      }));

    // Group accounts by currency
    const accountsByCurrency: Record<string, typeof accounts> = {};
    accounts.forEach(account => {
      const currency = account.currency || 'USD';
      if (!accountsByCurrency[currency]) {
        accountsByCurrency[currency] = [];
      }
      accountsByCurrency[currency].push(account);
    });

    // Calculate entity statistics
    const entityStats = entities.map(entity => {
      const entityAccounts = accounts.filter(acc => acc.entity_id === entity.entity_id);
      const entityBalance = entityAccounts.reduce((sum, acc) => {
        const balance = acc.balance ?? acc.current_balance ?? acc.available_balance ?? 0;
        return sum + balance;
      }, 0);
      return {
        entity_id: entity.entity_id,
        entity_name: entity.entity_name,
        account_count: entityAccounts.length,
        total_balance: entityBalance,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        totalCashUSD,
        inflows,
        outflows,
        netCashFlow,
        accountCount: accounts.length,
        entityCount: entities.length,
        transactionCount: transactions.length,
        recentTransactions: recentTransactionsList,
        accountsByCurrency,
        entityStats,
      },
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

