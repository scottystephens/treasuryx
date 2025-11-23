import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  req: Request,
  { params }: { params: { connectionId: string } }
) {
  try {
    const connectionId = params.connectionId;

    // Check connection
    const { data: connection, error: connError } = await supabase
      .from('connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      return NextResponse.json({
        error: 'Connection not found',
        connectionError: connError,
      }, { status: 404 });
    }

    // Check tokens
    const { data: tokens, error: tokenError } = await supabase
      .from('provider_tokens')
      .select('*')
      .eq('connection_id', connectionId)
      .eq('status', 'active');

    // Check raw accounts
    const { data: rawAccounts, error: rawAccError } = await supabase
      .from('plaid_accounts')
      .select('count', { count: 'exact' })
      .eq('connection_id', connectionId);

    // Check raw transactions
    const { data: rawTxs, error: rawTxError } = await supabase
      .from('plaid_transactions')
      .select('count', { count: 'exact' })
      .eq('connection_id', connectionId);

    // Check normalized accounts
    const { data: accounts, error: accError } = await supabase
      .from('accounts')
      .select('count', { count: 'exact' })
      .eq('connection_id', connectionId);

    // Check normalized transactions
    const { data: txs, error: txError } = await supabase
      .from('transactions')
      .select('count', { count: 'exact' })
      .eq('connection_id', connectionId);

    return NextResponse.json({
      connection: {
        id: connection.id,
        provider: connection.provider,
        status: connection.status,
        created_at: connection.created_at,
        last_sync_at: connection.last_sync_at,
      },
      tokens: {
        count: tokens?.length || 0,
        activeTokens: tokens?.filter(t => t.status === 'active').length || 0,
        hasAccessToken: tokens?.some(t => t.access_token) || false,
        hasRefreshToken: tokens?.some(t => t.refresh_token) || false,
        tokenError: tokenError?.message,
      },
      rawData: {
        plaidAccounts: rawAccounts?.length || 0,
        plaidTransactions: rawTxs?.length || 0,
        rawAccError: rawAccError?.message,
        rawTxError: rawTxError?.message,
      },
      normalizedData: {
        accounts: accounts?.length || 0,
        transactions: txs?.length || 0,
        accError: accError?.message,
        txError: txError?.message,
      },
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
