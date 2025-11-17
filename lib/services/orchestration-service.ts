// Orchestration Service - Sync scheduling and health management
import { supabase } from '../supabase';

export interface ConnectionScheduleUpdate {
  connection_id: string;
  sync_schedule: 'manual' | 'hourly' | '4hours' | '12hours' | 'daily' | 'weekly' | 'custom';
  sync_cron_expression?: string;
  sync_enabled: boolean;
  sync_priority?: number;
}

export interface SyncJobResult {
  connection_id: string;
  status: 'success' | 'failed' | 'skipped';
  message: string;
  duration_ms?: number;
  records_synced?: number;
}

/**
 * Update connection sync schedule
 */
export async function updateConnectionSchedule(
  updates: ConnectionScheduleUpdate
): Promise<void> {
  try {
    const { error } = await supabase
      .from('connections')
      .update({
        sync_schedule: updates.sync_schedule,
        sync_cron_expression: updates.sync_cron_expression,
        sync_enabled: updates.sync_enabled,
        sync_priority: updates.sync_priority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', updates.connection_id);

    if (error) throw error;

    // Calculate and update next sync time
    await supabase.rpc('update_next_sync_time', {
      p_connection_id: updates.connection_id,
    });
  } catch (error) {
    console.error('Error updating connection schedule:', error);
    throw error;
  }
}

/**
 * Bulk update connection schedules
 */
export async function bulkUpdateConnectionSchedules(
  updates: ConnectionScheduleUpdate[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (const update of updates) {
    try {
      await updateConnectionSchedule(update);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(
        `Failed to update ${update.connection_id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return results;
}

/**
 * Get connections ready for sync based on schedule
 */
export async function getConnectionsReadyForSync(
  schedule: string
): Promise<Array<{ connection_id: string; tenant_id: string; provider: string; name: string }>> {
  try {
    const { data, error } = await supabase.rpc('get_connections_ready_for_sync', {
      p_schedule: schedule,
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching connections ready for sync:', error);
    throw error;
  }
}

/**
 * Record sync job result and update connection health
 */
export async function recordSyncResult(
  connectionId: string,
  result: SyncJobResult
): Promise<void> {
  try {
    const updates: Record<string, any> = {
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (result.status === 'success') {
      updates.last_success_at = new Date().toISOString();
      updates.consecutive_failures = 0;
      updates.last_error = null;
      updates.last_error_at = null;
    } else if (result.status === 'failed') {
      updates.last_error = result.message;
      updates.last_error_at = new Date().toISOString();
      
      // Increment consecutive failures
      const { data: current } = await supabase
        .from('connections')
        .select('consecutive_failures')
        .eq('id', connectionId)
        .single();

      updates.consecutive_failures = (current?.consecutive_failures || 0) + 1;
    }

    await supabase.from('connections').update(updates).eq('id', connectionId);

    // Update health score
    await supabase.rpc('update_connection_health', {
      p_connection_id: connectionId,
    });

    // Update next sync time
    await supabase.rpc('update_next_sync_time', {
      p_connection_id: connectionId,
    });
  } catch (error) {
    console.error('Error recording sync result:', error);
    throw error;
  }
}

/**
 * Get connection health statistics
 */
export async function getConnectionHealthStats() {
  try {
    const { data, error } = await supabase.from('connection_stats').select('*');

    if (error) throw error;

    // Calculate summary statistics
    const totalConnections = data?.length || 0;
    const healthyConnections = data?.filter((c) => c.health_score >= 80).length || 0;
    const warningConnections =
      data?.filter((c) => c.health_score >= 50 && c.health_score < 80).length || 0;
    const criticalConnections = data?.filter((c) => c.health_score < 50).length || 0;

    const avgHealthScore =
      totalConnections > 0
        ? Math.round(
            data.reduce((sum, c) => sum + (c.health_score || 0), 0) / totalConnections
          )
        : 100;

    return {
      totalConnections,
      healthyConnections,
      warningConnections,
      criticalConnections,
      avgHealthScore,
      connections: data || [],
    };
  } catch (error) {
    console.error('Error fetching connection health stats:', error);
    throw error;
  }
}

/**
 * Trigger immediate sync for a connection
 */
export async function triggerImmediateSync(
  connectionId: string,
  provider: string,
  tenantId: string
): Promise<SyncJobResult> {
  try {
    // Call the sync API endpoint
    const response = await fetch(`/api/banking/${provider}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionId,
        tenantId,
        syncAccounts: true,
        syncTransactions: true,
        forceSync: true,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Sync failed');
    }

    return {
      connection_id: connectionId,
      status: 'success',
      message: 'Sync completed successfully',
      duration_ms: data.summary?.duration || 0,
      records_synced: data.summary?.transactionsSynced || 0,
    };
  } catch (error) {
    return {
      connection_id: connectionId,
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Record API usage for a provider
 */
export async function recordProviderApiUsage(
  providerId: string,
  tenantId: string,
  apiCallsCount: number = 1,
  transactionsSynced: number = 0,
  accountsSynced: number = 0
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Upsert usage record
    const { error } = await supabase.from('provider_api_usage').upsert(
      {
        provider_id: providerId,
        tenant_id: tenantId,
        date: today,
        api_calls_count: apiCallsCount,
        transactions_synced: transactionsSynced,
        accounts_synced: accountsSynced,
        sync_jobs_count: 1,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'provider_id,tenant_id,date',
        ignoreDuplicates: false,
      }
    );

    if (error) throw error;
  } catch (error) {
    console.error('Error recording provider API usage:', error);
    // Don't throw - usage tracking failures shouldn't break sync operations
  }
}

/**
 * Get provider API usage summary
 */
export async function getProviderApiUsageSummary(days: number = 7) {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const { data, error } = await supabase
      .from('provider_api_usage')
      .select('*')
      .gte('date', startDate)
      .order('date', { ascending: false });

    if (error) throw error;

    // Group by provider
    const byProvider = (data || []).reduce(
      (acc, usage) => {
        if (!acc[usage.provider_id]) {
          acc[usage.provider_id] = {
            provider_id: usage.provider_id,
            total_api_calls: 0,
            total_transactions: 0,
            total_accounts: 0,
            total_sync_jobs: 0,
            api_calls_limit: usage.api_calls_limit,
          };
        }

        acc[usage.provider_id].total_api_calls += usage.api_calls_count || 0;
        acc[usage.provider_id].total_transactions += usage.transactions_synced || 0;
        acc[usage.provider_id].total_accounts += usage.accounts_synced || 0;
        acc[usage.provider_id].total_sync_jobs += usage.sync_jobs_count || 0;

        return acc;
      },
      {} as Record<string, any>
    );

    return Object.values(byProvider);
  } catch (error) {
    console.error('Error fetching provider API usage summary:', error);
    throw error;
  }
}

/**
 * Reset connection health (clear consecutive failures)
 */
export async function resetConnectionHealth(connectionId: string): Promise<void> {
  try {
    await supabase
      .from('connections')
      .update({
        consecutive_failures: 0,
        last_error: null,
        last_error_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);

    // Recalculate health score
    await supabase.rpc('update_connection_health', {
      p_connection_id: connectionId,
    });
  } catch (error) {
    console.error('Error resetting connection health:', error);
    throw error;
  }
}

