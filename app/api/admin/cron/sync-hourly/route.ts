// Vercel Cron - Sync Connections on Hourly Schedule
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
    // Verify this is a cron request (Vercel sets this header)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting hourly sync cron job...');

    // Get connections ready for hourly sync
    const connections = await getConnectionsReadyForSync('hourly');

    console.log(`Found ${connections.length} connections to sync`);

    const results = [];

    // Process connections in batches to avoid timeout
    for (const conn of connections.slice(0, 20)) {
      // Limit to 20 per run
      try {
        console.log(`Syncing connection: ${conn.name}`);
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
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`✅ Hourly sync completed. ${results.length} connections processed`);

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

