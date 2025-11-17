import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import Papa from 'papaparse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EntityRow {
  entity_name: string;
  type: string;
  jurisdiction: string;
  status: string;
  tax_id?: string;
  contact_email?: string;
  phone?: string;
  address?: string;
  website?: string;
  description?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data: EntityRow[];
}

const VALID_ENTITY_TYPES = ['Corporation', 'LLC', 'Partnership', 'Sole Proprietorship', 'Trust', 'Non-Profit', 'Other'];
const VALID_STATUSES = ['Active', 'Inactive', 'Dissolved'];
const REQUIRED_FIELDS = ['entity_name', 'type', 'jurisdiction', 'status'];

/**
 * POST /api/entities/bulk-import
 * Bulk import entities from CSV
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user and tenant
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant from request body
    const body = await request.json();
    const { tenantId, csvData, mode = 'validate' } = body;

    if (!tenantId || !csvData) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tenantId or csvData' },
        { status: 400 }
      );
    }

    // Verify user has access to tenant
    const { data: membership } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse CSV
    const parseResult = await new Promise<Papa.ParseResult<EntityRow>>((resolve) => {
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase().replace(/ /g, '_'),
        complete: resolve,
      });
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'CSV parsing failed',
        details: parseResult.errors,
      }, { status: 400 });
    }

    // Validate data
    const validation = validateEntityData(parseResult.data);

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        validation: {
          valid: false,
          errors: validation.errors,
          rowCount: parseResult.data.length,
        },
      });
    }

    // If mode is 'validate', return validation results only
    if (mode === 'validate') {
      return NextResponse.json({
        success: true,
        validation: {
          valid: true,
          errors: [],
          rowCount: validation.data.length,
        },
        preview: validation.data.slice(0, 5), // Show first 5 rows
      });
    }

    // Mode is 'import' - proceed with import
    const results = {
      total: validation.data.length,
      imported: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; entity_name: string; error: string }>,
    };

    for (let i = 0; i < validation.data.length; i++) {
      const row = validation.data[i];
      
      try {
        // Generate entity ID
        const entityId = `ENT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Insert entity
        const { error: insertError } = await supabase
          .from('entities')
          .insert({
            entity_id: entityId,
            tenant_id: tenantId,
            entity_name: row.entity_name,
            type: row.type,
            jurisdiction: row.jurisdiction,
            status: row.status,
            tax_id: row.tax_id || null,
            contact_email: row.contact_email || null,
            phone: row.phone || null,
            address: row.address || null,
            website: row.website || null,
            description: row.description || null,
          });

        if (insertError) {
          // Check if it's a duplicate
          if (insertError.code === '23505') {
            results.skipped++;
            results.errors.push({
              row: i + 2, // +2 for header row and 0-based index
              entity_name: row.entity_name,
              error: 'Entity with this name already exists',
            });
          } else {
            results.errors.push({
              row: i + 2,
              entity_name: row.entity_name,
              error: insertError.message,
            });
          }
        } else {
          results.imported++;
        }
      } catch (error) {
        results.errors.push({
          row: i + 2,
          entity_name: row.entity_name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import entities',
      },
      { status: 500 }
    );
  }
}

/**
 * Validate entity data from CSV
 */
function validateEntityData(data: EntityRow[]): ValidationResult {
  const errors: ValidationError[] = [];
  const validData: EntityRow[] = [];

  if (data.length === 0) {
    errors.push({
      row: 0,
      field: 'file',
      message: 'CSV file is empty',
    });
    return { valid: false, errors, data: [] };
  }

  // Validate each row
  data.forEach((row, index) => {
    const rowNumber = index + 2; // +2 for header row and 0-based index

    // Check required fields
    REQUIRED_FIELDS.forEach((field) => {
      if (!row[field as keyof EntityRow] || String(row[field as keyof EntityRow]).trim() === '') {
        errors.push({
          row: rowNumber,
          field,
          message: `Required field '${field}' is missing or empty`,
        });
      }
    });

    // Validate entity type
    if (row.type && !VALID_ENTITY_TYPES.includes(row.type)) {
      errors.push({
        row: rowNumber,
        field: 'type',
        message: `Invalid entity type '${row.type}'. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
      });
    }

    // Validate status
    if (row.status && !VALID_STATUSES.includes(row.status)) {
      errors.push({
        row: rowNumber,
        field: 'status',
        message: `Invalid status '${row.status}'. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // Validate email format
    if (row.contact_email && row.contact_email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.contact_email)) {
        errors.push({
          row: rowNumber,
          field: 'contact_email',
          message: `Invalid email format: ${row.contact_email}`,
        });
      }
    }

    // Validate website URL
    if (row.website && row.website.trim() !== '') {
      try {
        new URL(row.website);
      } catch {
        errors.push({
          row: rowNumber,
          field: 'website',
          message: `Invalid URL format: ${row.website}`,
        });
      }
    }

    // If no errors for this row, add to valid data
    const rowErrors = errors.filter((e) => e.row === rowNumber);
    if (rowErrors.length === 0) {
      validData.push(row);
    }
  });

  // Check for duplicate entity names within the CSV
  const nameCount = new Map<string, number[]>();
  data.forEach((row, index) => {
    const name = row.entity_name?.trim().toLowerCase();
    if (name) {
      if (!nameCount.has(name)) {
        nameCount.set(name, []);
      }
      nameCount.get(name)!.push(index + 2);
    }
  });

  nameCount.forEach((rows, name) => {
    if (rows.length > 1) {
      rows.forEach((rowNumber) => {
        errors.push({
          row: rowNumber,
          field: 'entity_name',
          message: `Duplicate entity name '${name}' found in CSV (rows: ${rows.join(', ')})`,
        });
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    data: validData,
  };
}

