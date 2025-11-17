// Admin API - Connections Management
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
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

    // Check if user is super admin
    const isSuperAdmin = user.user_metadata?.is_super_admin === true;

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Try to get connections from connection_stats view first
    let connections: any[] = [];
    let error: any = null;

    // First, try the view
    const { data: viewData, error: viewError } = await supabase
      .from('connection_stats')
      .select('*')
      .order('last_job_at', { ascending: false, nullsFirst: false });

    if (viewError) {
      console.warn('connection_stats view error, falling back to connections table:', viewError);
      // Fallback to connections table if view doesn't exist or has issues
      const { data: connData, error: connError } = await supabase
        .from('connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (connError) {
        error = connError;
      } else {
        // Transform connections table data to match expected format
        connections = (connData || []).map((c: any) => ({
          connection_id: c.id,
          tenant_id: c.tenant_id,
          connection_name: c.name,
          provider: c.provider,
          status: c.status,
          sync_schedule: c.sync_schedule || 'manual',
          sync_enabled: c.sync_enabled ?? true,
          health_score: c.health_score || c.sync_health_score || 100,
          consecutive_failures: c.consecutive_failures || 0,
          last_sync_at: c.last_sync_at,
          next_sync_at: c.next_sync_at,
          last_success_at: c.last_successful_sync_at || c.last_sync_at,
          last_error: c.last_error,
          last_error_at: c.last_error_at,
          jobs_last_7_days: 0,
          jobs_last_24_hours: 0,
          total_successful_jobs: 0,
          total_failed_jobs: 0,
          avg_duration_ms: 0,
          total_records_imported: 0,
          last_job_at: c.last_sync_at,
          linked_accounts_count: 0,
        }));
      }
    } else {
      connections = viewData || [];
    }

    if (error) throw error;

    // Get unique tenant IDs and fetch tenant names
    const tenantIds = [...new Set(connections.map((c: any) => c.tenant_id).filter(Boolean))];
    let tenantMap = new Map();
    
    if (tenantIds.length > 0) {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name')
        .in('id', tenantIds);

      tenantMap = new Map((tenants || []).map((t: any) => [t.id, t.name]));
    }

    // Map the results to include tenant_name
    const connectionsWithTenantName = connections.map((conn: any) => ({
      ...conn,
      tenant_name: tenantMap.get(conn.tenant_id) || 'Unknown Tenant',
    }));

    console.log(`Found ${connectionsWithTenantName.length} connections`);

    return NextResponse.json({ success: true, connections: connectionsWithTenantName });
  } catch (error) {
    console.error('Error fetching connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Get user from server-side client
    const supabaseClient = await createClient();
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin
    const isSuperAdmin = user.user_metadata?.is_super_admin === true;

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { connectionId, updates } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    // Update connection
    const { error } = await supabase
      .from('connections')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating connection:', error);
    return NextResponse.json(
      { error: 'Failed to update connection' },
      { status: 500 }
    );
  }
}

