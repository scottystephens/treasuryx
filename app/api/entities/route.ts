/**
 * Entity CRUD API endpoints
 * GET /api/entities?tenantId=xxx - List entities
 * POST /api/entities - Create entity
 * PATCH /api/entities - Update entity
 * DELETE /api/entities?id=xxx&tenantId=xxx - Delete entity
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { CreateEntityInput, UpdateEntityInput } from '@/lib/types/entity';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const entityId = searchParams.get('id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Get single entity or all entities
    if (entityId) {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('entity_id', entityId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, entity: data });
    } else {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('entity_name');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, entities: data || [] });
    }
  } catch (error) {
    console.error('Get entities error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch entities' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entity = body as CreateEntityInput;

    if (!entity.tenant_id || !entity.entity_id || !entity.entity_name || !entity.type || !entity.jurisdiction) {
      return NextResponse.json(
        { error: 'Missing required fields: tenant_id, entity_id, entity_name, type, jurisdiction' },
        { status: 400 }
      );
    }

    // Check if entity_id already exists for this tenant
    const { data: existing } = await supabase
      .from('entities')
      .select('entity_id')
      .eq('tenant_id', entity.tenant_id)
      .eq('entity_id', entity.entity_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Entity ID already exists. Please choose a different ID.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('entities')
      .insert({
        entity_id: entity.entity_id,
        entity_name: entity.entity_name,
        type: entity.type,
        jurisdiction: entity.jurisdiction,
        tax_id: entity.tax_id,
        contact_email: entity.contact_email,
        description: entity.description,
        address: entity.address,
        phone: entity.phone,
        website: entity.website,
        metadata: entity.metadata || {},
        tenant_id: entity.tenant_id,
        status: 'Active', // New entities start as Active
      })
      .select()
      .single();

    if (error) {
      console.error('Insert entity error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      entity: data,
    });
  } catch (error) {
    console.error('Create entity error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create entity' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityId, tenantId, ...updates } = body as { entityId: string; tenantId: string } & UpdateEntityInput;

    if (!entityId || !tenantId) {
      return NextResponse.json(
        { error: 'Entity ID and Tenant ID are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('entities')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('entity_id', entityId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      entity: data,
    });
  } catch (error) {
    console.error('Update entity error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update entity' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entityId = searchParams.get('id');
    const tenantId = searchParams.get('tenantId');

    if (!entityId || !tenantId) {
      return NextResponse.json(
        { error: 'Entity ID and Tenant ID are required' },
        { status: 400 }
      );
    }

    // Check if entity has associated accounts
    const { count } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('entity_id', entityId);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete entity. It has ${count} associated account(s). Please remove the accounts first.` },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('entities')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('entity_id', entityId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Entity deleted successfully',
    });
  } catch (error) {
    console.error('Delete entity error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete entity' },
      { status: 500 }
    );
  }
}
