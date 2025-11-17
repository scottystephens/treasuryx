// Admin API - Orchestration - Update Schedules
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { updateConnectionSchedule, bulkUpdateConnectionSchedules } from '@/lib/services/orchestration-service';
import { logAdminAction } from '@/lib/services/admin-service';

export async function PUT(req: NextRequest) {
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
    const { updates, bulk } = body;

    if (bulk && Array.isArray(updates)) {
      // Bulk update
      const results = await bulkUpdateConnectionSchedules(updates);

      // Log admin action
      await logAdminAction(
        'bulk_update_schedules',
        'connection',
        undefined,
        { count: updates.length, results }
      );

      return NextResponse.json({ success: true, results });
    } else if (updates) {
      // Single update
      await updateConnectionSchedule(updates);

      // Log admin action
      await logAdminAction(
        'update_schedule',
        'connection',
        updates.connection_id,
        updates
      );

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error updating schedules:', error);
    return NextResponse.json(
      { error: 'Failed to update schedules' },
      { status: 500 }
    );
  }
}

