import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import Papa from 'papaparse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AccountRow {
  account_name: string;
  account_type: string;
  bank_name?: string;
  account_number?: string;
  currency: string;
  entity_name?: string;
  balance?: string | number;
  iban?: string;
  bic?: string;
  status: string;
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
  data: AccountRow[];
}

const VALID_ACCOUNT_TYPES = [
  'checking', 'savings', 'money_market', 'certificate_deposit', 'credit_card',
  'line_of_credit', 'loan', 'mortgage', 'investment_brokerage', 'retirement_401k',
  'retirement_ira', 'pension', 'trust', 'escrow', 'merchant', 'payroll',
  'treasury', 'foreign_exchange', 'crypto_wallet', 'other',
];

const VALID_STATUSES = ['active', 'inactive', 'closed'];
const REQUIRED_FIELDS = ['account_name', 'account_type', 'currency', 'status'];

/**
 * POST /api/accounts/bulk-import
 * Bulk import accounts from CSV
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user and tenant
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
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
    const parseResult = await new Promise<Papa.ParseResult<AccountRow>>((resolve) => {
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

    // Get entities for validation
    const { data: entities } = await supabase
      .from('entities')
      .select('entity_id, entity_name')
      .eq('tenant_id', tenantId);

    const entityMap = new Map(
      (entities || []).map((e) => [e.entity_name.toLowerCase(), e.entity_id])
    );

    // Validate data
    const validation = validateAccountData(parseResult.data, entityMap);

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
      errors: [] as Array<{ row: number; account_name: string; error: string }>,
    };

    for (let i = 0; i < validation.data.length; i++) {
      const row = validation.data[i];
      
      try {
        // Generate account ID
        const accountId = `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Get entity ID if entity_name is provided
        let entityId: string | null = null;
        if (row.entity_name && row.entity_name.trim() !== '') {
          entityId = entityMap.get(row.entity_name.toLowerCase()) || null;
        }

        // Parse balance
        let balance: number | null = null;
        if (row.balance !== undefined && row.balance !== null && String(row.balance).trim() !== '') {
          balance = parseFloat(String(row.balance).replace(/[^0-9.-]/g, ''));
          if (isNaN(balance)) {
            balance = null;
          }
        }

        // Insert account
        const { error: insertError } = await supabase
          .from('accounts')
          .insert({
            account_id: accountId,
            tenant_id: tenantId,
            account_name: row.account_name,
            account_type: row.account_type,
            bank_name: row.bank_name || null,
            account_number: row.account_number || null,
            currency: row.currency,
            entity_id: entityId,
            balance: balance,
            current_balance: balance,
            iban: row.iban || null,
            bic: row.bic || null,
            account_status: row.status,
            description: row.description || null,
          });

        if (insertError) {
          // Check if it's a duplicate
          if (insertError.code === '23505') {
            results.skipped++;
            results.errors.push({
              row: i + 2, // +2 for header row and 0-based index
              account_name: row.account_name,
              error: 'Account with this name already exists',
            });
          } else {
            results.errors.push({
              row: i + 2,
              account_name: row.account_name,
              error: insertError.message,
            });
          }
        } else {
          results.imported++;
        }
      } catch (error) {
        results.errors.push({
          row: i + 2,
          account_name: row.account_name,
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
        error: error instanceof Error ? error.message : 'Failed to import accounts',
      },
      { status: 500 }
    );
  }
}

/**
 * Validate account data from CSV
 */
function validateAccountData(
  data: AccountRow[],
  entityMap: Map<string, string>
): ValidationResult {
  const errors: ValidationError[] = [];
  const validData: AccountRow[] = [];

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
      if (!row[field as keyof AccountRow] || String(row[field as keyof AccountRow]).trim() === '') {
        errors.push({
          row: rowNumber,
          field,
          message: `Required field '${field}' is missing or empty`,
        });
      }
    });

    // Validate account type
    if (row.account_type && !VALID_ACCOUNT_TYPES.includes(row.account_type.toLowerCase())) {
      errors.push({
        row: rowNumber,
        field: 'account_type',
        message: `Invalid account type '${row.account_type}'. Must be one of: ${VALID_ACCOUNT_TYPES.join(', ')}`,
      });
    }

    // Validate status
    if (row.status && !VALID_STATUSES.includes(row.status.toLowerCase())) {
      errors.push({
        row: rowNumber,
        field: 'status',
        message: `Invalid status '${row.status}'. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // Validate currency (basic check - should be 3 letters)
    if (row.currency && !/^[A-Z]{3}$/i.test(row.currency)) {
      errors.push({
        row: rowNumber,
        field: 'currency',
        message: `Invalid currency code '${row.currency}'. Must be 3-letter ISO code (e.g., USD, EUR, GBP)`,
      });
    }

    // Validate balance format
    if (row.balance !== undefined && row.balance !== null && String(row.balance).trim() !== '') {
      const balanceStr = String(row.balance).replace(/[^0-9.-]/g, '');
      const balance = parseFloat(balanceStr);
      if (isNaN(balance)) {
        errors.push({
          row: rowNumber,
          field: 'balance',
          message: `Invalid balance format: ${row.balance}. Must be a number.`,
        });
      }
    }

    // Validate entity name exists (if provided)
    if (row.entity_name && row.entity_name.trim() !== '') {
      if (!entityMap.has(row.entity_name.toLowerCase())) {
        errors.push({
          row: rowNumber,
          field: 'entity_name',
          message: `Entity '${row.entity_name}' not found. Please create the entity first or leave empty.`,
        });
      }
    }

    // If no errors for this row, add to valid data
    const rowErrors = errors.filter((e) => e.row === rowNumber);
    if (rowErrors.length === 0) {
      validData.push(row);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    data: validData,
  };
}

