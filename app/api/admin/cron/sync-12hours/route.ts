// Vercel Cron - Sync Connections on 12-Hour Schedule
import { NextRequest, NextResponse } from 'next/server';
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

    console.log('🔄 Starting 12-hour sync cron job...');

    const connections = await getConnectionsReadyForSync('12hours');
    console.log(`Found ${connections.length} connections to sync`);

    const results = [];

    for (const conn of connections.slice(0, 20)) {
      try {
        const result = await triggerImmediateSync(
          conn.connection_id,
          conn.provider,
          conn.tenant_id
        );

        await recordSyncResult(conn.connection_id, result);

        results.push({
          connection_id: conn.connection_id,
          status: result.status,
        });
      } catch (error) {
        console.error(`Error syncing ${conn.connection_id}:`, error);
        results.push({
          connection_id: conn.connection_id,
          status: 'failed',
        });
      }
    }

    console.log(`✅ 12-hour sync completed. ${results.length} connections processed`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}

