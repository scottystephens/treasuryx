// Admin API - Tenants Management
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getAllTenantsWithStats, getTenantDetails } from '@/lib/services/admin-service';

export async function GET(req: NextRequest) {
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

    // Check if requesting single tenant details
    const tenantId = req.nextUrl.searchParams.get('id');

    if (tenantId) {
      const details = await getTenantDetails(tenantId);
      return NextResponse.json({ success: true, tenant: details });
    }

    // Get all tenants with stats
    const tenants = await getAllTenantsWithStats();

    return NextResponse.json({ success: true, tenants });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenants' },
      { status: 500 }
    );
  }
}

