// Vercel Cron - Health Check and Maintenance
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const maxDuration = 60; // 1 minute max

export async function GET(req: NextRequest) {
  try {
    // Verify this is a cron request
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🏥 Starting health check cron job...');

    // Update health scores for all connections
    const { data: connections } = await supabase
      .from('connections')
      .select('id')
      .limit(100);

    if (connections) {
      for (const conn of connections) {
        await supabase.rpc('update_connection_health', {
          p_connection_id: conn.id,
        });
      }
      console.log(`Updated health scores for ${connections.length} connections`);
    }

    // Archive old logs (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: oldLogs, error: logsError } = await supabase
      .from('ingestion_jobs')
      .delete()
      .lt('created_at', thirtyDaysAgo)
      .select('id');

    if (!logsError && oldLogs) {
      console.log(`Archived ${oldLogs.length} old log entries`);
    }

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
      avg_health: avgHealth,
      connections_checked: connections?.length || 0,
      logs_archived: oldLogs?.length || 0,
    });
  } catch (error) {
    console.error('Health check cron error:', error);
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}

