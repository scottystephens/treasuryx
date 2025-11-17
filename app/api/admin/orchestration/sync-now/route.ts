// Admin API - Orchestration - Trigger Immediate Sync
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { triggerImmediateSync } from '@/lib/services/orchestration-service';
import { logAdminAction } from '@/lib/services/admin-service';

export async function POST(req: NextRequest) {
  try {
    // Get user from server-side client
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    const { connectionId, provider, tenantId } = body;

    if (!connectionId || !provider || !tenantId) {
      return NextResponse.json(
        { error: 'Connection ID, provider, and tenant ID are required' },
        { status: 400 }
      );
    }

    // Trigger sync
    const result = await triggerImmediateSync(connectionId, provider, tenantId);

    // Log admin action
    await logAdminAction(
      'trigger_sync',
      'connection',
      connectionId,
      { provider, result }
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error triggering sync:', error);
    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    );
  }
}

