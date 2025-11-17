// Admin Service - Server-side functions for super admin operations
import { supabase } from '../supabase';

export interface TenantStats {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  user_count: number;
  connection_count: number;
  account_count: number;
  last_activity: string | null;
  health_score: number;
}

export interface ConnectionWithTenant {
  id: string;
  tenant_id: string;
  tenant_name: string;
  name: string;
  connection_type: string;
  provider: string | null;
  status: string;
  sync_schedule: string;
  sync_enabled: boolean;
  health_score: number;
  last_sync_at: string | null;
  next_sync_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  created_at: string;
}

export interface SystemStats {
  total_tenants: number;
  total_users: number;
  total_connections: number;
  active_connections: number;
  total_accounts: number;
  total_transactions: number;
  sync_jobs_24h: number;
  failed_jobs_24h: number;
  error_rate_24h: number;
}

export interface ProviderUsage {
  provider_id: string;
  date: string;
  api_calls_count: number;
  api_calls_limit: number | null;
  transactions_synced: number;
  accounts_synced: number;
  error_count: number;
  usage_percentage: number;
}

/**
 * Get system-wide statistics
 */
export async function getSystemStats(): Promise<SystemStats> {
  try {
    // Get tenant count
    const { count: tenantCount } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true });

    // Get user count
    const { count: userCount } = await supabase
      .from('user_tenants')
      .select('*', { count: 'exact', head: true });

    // Get connection stats
    const { data: connectionData } = await supabase
      .from('connections')
      .select('status')
      .eq('status', 'active');

    const totalConnections = connectionData?.length || 0;
    const activeConnections = connectionData?.filter((c) => c.status === 'active').length || 0;

    // Get account count
    const { count: accountCount } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true });

    // Get transaction count
    const { count: transactionCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    // Get sync job stats (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentJobs } = await supabase
      .from('ingestion_jobs')
      .select('status')
      .gte('created_at', twentyFourHoursAgo);

    const syncJobs24h = recentJobs?.length || 0;
    const failedJobs24h = recentJobs?.filter((j) => j.status === 'failed').length || 0;
    const errorRate24h = syncJobs24h > 0 ? (failedJobs24h / syncJobs24h) * 100 : 0;

    return {
      total_tenants: tenantCount || 0,
      total_users: userCount || 0,
      total_connections: totalConnections,
      active_connections: activeConnections,
      total_accounts: accountCount || 0,
      total_transactions: transactionCount || 0,
      sync_jobs_24h: syncJobs24h,
      failed_jobs_24h: failedJobs24h,
      error_rate_24h: Math.round(errorRate24h * 10) / 10,
    };
  } catch (error) {
    console.error('Error fetching system stats:', error);
    throw error;
  }
}

/**
 * Get all tenants with statistics
 */
export async function getAllTenantsWithStats(): Promise<TenantStats[]> {
  try {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id, name, slug, plan, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch stats for each tenant
    const tenantsWithStats = await Promise.all(
      (tenants || []).map(async (tenant) => {
        // Get user count
        const { count: userCount } = await supabase
          .from('user_tenants')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);

        // Get connection count and average health
        const { data: connections } = await supabase
          .from('connections')
          .select('health_score, updated_at')
          .eq('tenant_id', tenant.id);

        const connectionCount = connections?.length || 0;
        const avgHealth =
          connectionCount > 0
            ? Math.round(
                (connections || []).reduce((sum, c) => sum + (c.health_score || 100), 0) / connectionCount
              )
            : 100;

        // Get account count
        const { count: accountCount } = await supabase
          .from('accounts')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);

        // Get last activity (most recent connection update or job)
        const { data: lastJob } = await supabase
          .from('ingestion_jobs')
          .select('created_at')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          ...tenant,
          user_count: userCount || 0,
          connection_count: connectionCount,
          account_count: accountCount || 0,
          last_activity: lastJob?.created_at || null,
          health_score: avgHealth,
        };
      })
    );

    return tenantsWithStats;
  } catch (error) {
    console.error('Error fetching tenants with stats:', error);
    throw error;
  }
}

/**
 * Get all connections across all tenants
 */
export async function getAllConnectionsAcrossTenants(): Promise<ConnectionWithTenant[]> {
  try {
    const { data, error } = await supabase.rpc('get_all_connections');

    if (error) throw error;

    return (data || []) as ConnectionWithTenant[];
  } catch (error) {
    console.error('Error fetching all connections:', error);
    throw error;
  }
}

/**
 * Get provider API usage statistics
 */
export async function getProviderUsage(days: number = 7): Promise<ProviderUsage[]> {
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

    return (data || []).map((usage) => ({
      ...usage,
      usage_percentage:
        usage.api_calls_limit && usage.api_calls_limit > 0
          ? Math.round((usage.api_calls_count / usage.api_calls_limit) * 100)
          : 0,
    }));
  } catch (error) {
    console.error('Error fetching provider usage:', error);
    throw error;
  }
}

/**
 * Log admin action for audit trail
 */
export async function logAdminAction(
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await supabase.rpc('log_admin_action', {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId || null,
      p_details: details || {},
    });
  } catch (error) {
    console.error('Error logging admin action:', error);
    // Don't throw - logging failures shouldn't break admin operations
  }
}

/**
 * Get recent admin audit logs
 */
export async function getAdminAuditLogs(limit: number = 100) {
  try {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching admin audit logs:', error);
    throw error;
  }
}

/**
 * Get tenant details with full statistics
 */
export async function getTenantDetails(tenantId: string) {
  try {
    // Get tenant basic info
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;

    // Get connections
    const { data: connections } = await supabase
      .from('connections')
      .select('*')
      .eq('tenant_id', tenantId);

    // Get accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('tenant_id', tenantId);

    // Get recent jobs
    const { data: recentJobs } = await supabase
      .from('ingestion_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get users
    const { data: users } = await supabase
      .from('user_tenants')
      .select('user_id, role')
      .eq('tenant_id', tenantId);

    return {
      tenant,
      connections: connections || [],
      accounts: accounts || [],
      recentJobs: recentJobs || [],
      users: users || [],
    };
  } catch (error) {
    console.error('Error fetching tenant details:', error);
    throw error;
  }
}

