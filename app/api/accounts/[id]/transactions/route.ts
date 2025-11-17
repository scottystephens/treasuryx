// API endpoint to fetch transactions for a specific account
// GET /api/accounts/[id]/transactions?tenantId=xxx&limit=xxx&startDate=xxx&endDate=xxx

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    const accountId = params.id;

    // Build query
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false });

    // Filter by account_id (could be UUID id or TEXT account_id)
    // Try both to handle different account ID formats
    const { data: account } = await supabase
      .from('accounts')
      .select('account_id, id')
      .eq('tenant_id', tenantId)
      .or(`account_id.eq.${accountId},id.eq.${accountId}`)
      .single();

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Use account_id (TEXT) for transaction filtering
    query = query.eq('account_id', account.account_id);

    // Date filtering
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    // Limit
    if (limit) {
      query = query.limit(limit);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transactions: transactions || [],
      count: transactions?.length || 0,
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

