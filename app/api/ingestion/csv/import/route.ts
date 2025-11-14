// API route for importing CSV transactions into the database
// POST /api/ingestion/csv/import

import { NextRequest, NextResponse } from 'next/server';
import { CSVParser, ColumnMapping } from '@/lib/parsers/csv-parser';
import {
  createConnection,
  createIngestionJob,
  updateIngestionJob,
  createRawIngestionData,
  importTransactions,
  deleteTransactionsByConnection,
  createAuditLog,
} from '@/lib/supabase';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      content,
      fileName,
      fileSize,
      columnMapping,
      config,
      connectionName,
      accountId,
      tenantId,
      importMode,
      userId, // We'll pass this from the client
    } = body;

    console.log('📥 Import request received:', {
      hasContent: !!content,
      hasColumnMapping: !!columnMapping,
      connectionName,
      accountId,
      tenantId,
      userId,
    });

    // Validate required fields
    if (!content || !columnMapping || !connectionName || !accountId || !tenantId || !userId) {
      console.error('Missing required fields:', {
        content: !!content,
        columnMapping: !!columnMapping,
        connectionName: !!connectionName,
        accountId: !!accountId,
        tenantId: !!tenantId,
        userId: !!userId,
      });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify user has access to this tenant by checking user_tenants table
    const supabase = await createClient();
    
    console.log('🔍 Checking user_tenants for:', { userId, tenantId });
    
    // First, let's see all user_tenants for this user
    const { data: allUserTenants, error: allTenantsError } = await supabase
      .from('user_tenants')
      .select('*')
      .eq('user_id', userId);
    
    console.log('📊 All tenants for user:', allUserTenants);
    
    const { data: userTenant, error: tenantCheckError } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (tenantCheckError || !userTenant) {
      console.error('❌ User not authorized for tenant:', { 
        userId, 
        tenantId, 
        error: tenantCheckError,
        errorCode: tenantCheckError?.code,
        errorMessage: tenantCheckError?.message,
        allUserTenants: allUserTenants?.length || 0
      });
      return NextResponse.json(
        { 
          error: 'Unauthorized - User does not have access to this organization',
          debug: {
            userId,
            tenantId,
            errorCode: tenantCheckError?.code,
            userTenantsCount: allUserTenants?.length || 0
          }
        },
        { status: 403 }
      );
    }

    console.log('✅ User authorized:', { userId, tenantId, role: userTenant.role });

    // Step 1: Create connection record
    let connection;
    try {
      connection = await createConnection({
        tenant_id: tenantId,
        name: connectionName,
        connection_type: 'csv',
        config: {
          columnMapping,
          ...config,
        },
        account_id: accountId,
        import_mode: importMode || 'append',
        created_by: userId,
      });
    } catch (error) {
      console.error('Error creating connection:', error);
      return NextResponse.json(
        { error: 'Failed to create connection' },
        { status: 500 }
      );
    }

    // Step 2: Create ingestion job
    let job;
    try {
      job = await createIngestionJob({
        tenant_id: tenantId,
        connection_id: connection.id,
        job_type: 'manual',
        status: 'running',
      });
    } catch (error) {
      console.error('Error creating job:', error);
      return NextResponse.json(
        { error: 'Failed to create ingestion job' },
        { status: 500 }
      );
    }

    try {
      // Step 3: Store raw CSV data
      const rawData = await createRawIngestionData({
        tenant_id: tenantId,
        connection_id: connection.id,
        job_id: job.id,
        raw_data: { csvContent: content, columnMapping, config },
        file_name: fileName,
        file_size_bytes: fileSize,
      });

      // Step 4: Parse CSV
      const parser = new CSVParser({
        columnMapping: columnMapping as ColumnMapping,
        ...config,
      });

      const parseResult = await parser.parse(content);

      if (!parseResult.success || parseResult.transactions.length === 0) {
        await updateIngestionJob(job.id, {
          status: 'failed',
          error_message: 'CSV parsing failed or no valid transactions found',
          error_details: {
            errors: parseResult.errors,
            warnings: parseResult.warnings,
          },
          completed_at: new Date().toISOString(),
        });

        return NextResponse.json(
          {
            success: false,
            error: 'CSV parsing failed',
            details: parseResult.errors,
          },
          { status: 400 }
        );
      }

      // Step 5: Handle override mode (delete existing transactions)
      if (importMode === 'override') {
        await deleteTransactionsByConnection(tenantId, connection.id);
      }

      // Step 6: Transform parsed transactions to database format
      const transactionsToImport = parseResult.transactions.map((tx, index) => ({
        tenant_id: tenantId,
        account_id: accountId,
        transaction_date: tx.date,
        amount: tx.amount,
        currency: 'USD', // TODO: Make configurable
        description: tx.description,
        transaction_type: tx.type || 'credit',
        connection_id: connection.id,
        external_transaction_id: tx.reference || `row-${tx.rowNumber}`,
        source_type: 'csv',
        import_job_id: job.id,
        raw_data_id: rawData.id,
        metadata: tx.metadata,
      }));

      // Step 7: Import transactions
      const imported = await importTransactions(transactionsToImport);

      // Step 8: Update job status
      await updateIngestionJob(job.id, {
        status: 'completed',
        records_fetched: parseResult.summary.totalRows,
        records_processed: parseResult.summary.validRows,
        records_imported: imported.length,
        records_skipped: parseResult.summary.invalidRows,
        records_failed: 0,
        summary: {
          parseResult: parseResult.summary,
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        },
        completed_at: new Date().toISOString(),
      });

      // Step 9: Create audit log
      await createAuditLog({
        tenant_id: tenantId,
        connection_id: connection.id,
        job_id: job.id,
        event_type: 'csv_import_completed',
        event_data: {
          fileName,
          recordsImported: imported.length,
          importMode,
        },
        user_id: userId,
      });

      return NextResponse.json({
        success: true,
        connection: {
          id: connection.id,
          name: connection.name,
        },
        job: {
          id: job.id,
          status: 'completed',
        },
        summary: {
          totalRows: parseResult.summary.totalRows,
          imported: imported.length,
          skipped: parseResult.summary.invalidRows,
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        },
      });

    } catch (error) {
      console.error('Import error:', error);

      // Update job as failed
      await updateIngestionJob(job.id, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Import failed',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('CSV import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}

