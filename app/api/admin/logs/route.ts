// Admin API - Logs Viewer
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

    // Get query parameters
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100');
    const status = req.nextUrl.searchParams.get('status');
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    const connectionId = req.nextUrl.searchParams.get('connectionId');

    // Build query
    let query = supabase
      .from('ingestion_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    if (connectionId) {
      query = query.eq('connection_id', connectionId);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, logs: logs || [] });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

