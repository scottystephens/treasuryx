// API route for managing connections
// GET /api/connections - List all connections for tenant
// DELETE /api/connections?id=xxx - Delete a connection

import { NextRequest, NextResponse } from 'next/server';
import { getConnections, getConnection, deleteConnection } from '@/lib/supabase';
import { createClient } from '@/lib/supabase-server';

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

    // Get tenant ID and connection ID from query params
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const connectionId = searchParams.get('id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // If connection ID is provided, fetch a single connection
    if (connectionId) {
      try {
        const connection = await getConnection(tenantId, connectionId);
        
        if (!connection) {
          return NextResponse.json(
            { error: 'Connection not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          connection,
        });
      } catch (error) {
        console.error('Get connection error:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to fetch connection' },
          { status: 500 }
        );
      }
    }

    // Otherwise, fetch all connections for the tenant
    const connections = await getConnections(tenantId);

    return NextResponse.json({
      success: true,
      connections,
    });

  } catch (error) {
    console.error('Get connections error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Get user from server-side client
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get connection ID and tenant ID from query params
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('id');
    const tenantId = searchParams.get('tenantId');

    if (!connectionId || !tenantId) {
      return NextResponse.json(
        { error: 'Connection ID and Tenant ID are required' },
        { status: 400 }
      );
    }

    await deleteConnection(tenantId, connectionId);

    return NextResponse.json({
      success: true,
      message: 'Connection deleted successfully',
    });

  } catch (error) {
    console.error('Delete connection error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete connection' },
      { status: 500 }
    );
  }
}

