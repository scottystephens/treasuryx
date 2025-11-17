// Admin API - Provider API Usage
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getProviderApiUsageSummary } from '@/lib/services/orchestration-service';

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

    // Get query parameters
    const days = parseInt(req.nextUrl.searchParams.get('days') || '7');

    // Get provider usage summary
    const usage = await getProviderApiUsageSummary(days);

    return NextResponse.json({ success: true, usage });
  } catch (error) {
    console.error('Error fetching provider usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch provider usage' },
      { status: 500 }
    );
  }
}

