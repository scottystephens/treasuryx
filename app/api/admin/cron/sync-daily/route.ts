// Vercel Cron - Daily Sync and Health Check
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

    console.log('🔄 Starting daily sync and maintenance job...');

    // PART 1: Sync connections scheduled for daily
    const connections = await getConnectionsReadyForSync('daily');
    console.log(`Found ${connections.length} connections to sync`);

    const results = [];
    for (const conn of connections.slice(0, 50)) {
      try {
        const result = await triggerImmediateSync(
          conn.connection_id,
          conn.provider,
          conn.tenant_id
        );
        await recordSyncResult(conn.connection_id, result);
        results.push({ connection_id: conn.connection_id, status: result.status });
      } catch (error) {
        console.error(`Error syncing ${conn.connection_id}:`, error);
        results.push({ connection_id: conn.connection_id, status: 'failed' });
      }
    }

    console.log(`✅ Daily sync completed. ${results.length} connections processed`);

    // PART 2: Health check and maintenance
    console.log('🏥 Starting health check...');
    
    // Update health scores for all connections
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

    // Archive old logs (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: oldLogs } = await supabase
      .from('ingestion_jobs')
      .delete()
      .lt('created_at', thirtyDaysAgo)
      .select('id');

    console.log(`Archived ${oldLogs?.length || 0} old log entries`);

    // Record system health metric
    const { data: healthStats } = await supabase
      .from('connection_stats')
      .select('health_score');

    const avgHealth = healthStats && healthStats.length > 0
      ? Math.round(
          healthStats.reduce((sum, c) => sum + (c.health_score || 0), 0) /
            healthStats.length
        )
      : 100;

    await supabase.from('system_health_metrics').insert({
      metric_name: 'avg_connection_health',
      metric_value: avgHealth,
      metric_unit: 'score',
      status: avgHealth >= 80 ? 'healthy' : avgHealth >= 50 ? 'warning' : 'critical',
    });

    console.log('✅ Health check completed');

    return NextResponse.json({
      success: true,
      sync: {
        processed: results.length,
        results,
      },
      health: {
        avg_health: avgHealth,
        connections_checked: allConnections?.length || 0,
        logs_archived: oldLogs?.length || 0,
      },
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}

