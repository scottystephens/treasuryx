// Vercel Cron - Daily Bank Account Refresh for All Tenants
// Syncs all banking provider connections scheduled for daily refresh
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  getConnectionsReadyForSync,
  triggerImmediateSync,
  recordSyncResult,
} from '@/lib/services/orchestration-service';

export const maxDuration = 300; // 5 minutes max

export async function GET(req: NextRequest) {
  try {
    // Verify this is a cron request
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting daily bank account refresh for all tenants...');

    // Get all connections scheduled for daily sync that are enabled
    const connections = await getConnectionsReadyForSync('daily');
    console.log(`Found ${connections.length} connections scheduled for daily refresh`);

    const results = [];
    const errors: string[] = [];

    // Process up to 50 connections per run (to avoid timeout)
    for (const conn of connections.slice(0, 50)) {
      try {
        console.log(`Syncing connection: ${conn.name} (${conn.provider})`);
        
        const result = await triggerImmediateSync(
          conn.connection_id,
          conn.provider,
          conn.tenant_id
        );
        
        await recordSyncResult(conn.connection_id, result);
        
        results.push({
          connection_id: conn.connection_id,
          connection_name: conn.name,
          tenant_id: conn.tenant_id,
          provider: conn.provider,
          status: result.status,
          records_synced: result.records_synced || 0,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error syncing ${conn.connection_id}:`, errorMsg);
        errors.push(`${conn.name}: ${errorMsg}`);
        
        results.push({
          connection_id: conn.connection_id,
          connection_name: conn.name,
          tenant_id: conn.tenant_id,
          provider: conn.provider,
          status: 'failed',
          error: errorMsg,
        });
      }
    }

    // Update health scores for all connections
    console.log('🏥 Updating connection health scores...');
    const { data: allConnections } = await supabase
      .from('connections')
      .select('id')
      .limit(100);

    if (allConnections) {
      for (const conn of allConnections) {
        await supabase.rpc('update_connection_health', {
          p_connection_id: conn.id,
        });
      }
      console.log(`Updated health scores for ${allConnections.length} connections`);
    }

    const successful = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const totalRecordsSynced = results.reduce((sum, r) => sum + (r.records_synced || 0), 0);

    console.log(`✅ Daily bank refresh completed:`);
    console.log(`   - ${successful} successful, ${failed} failed`);
    console.log(`   - ${totalRecordsSynced} total records synced`);

    return NextResponse.json({
      success: true,
      summary: {
        total_connections: connections.length,
        processed: results.length,
        successful,
        failed,
        total_records_synced: totalRecordsSynced,
      },
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Daily bank refresh cron error:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

