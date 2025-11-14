// API route for uploading CSV files and parsing them
// POST /api/ingestion/csv/upload

import { NextRequest, NextResponse } from 'next/server';
import { CSVParser } from '@/lib/parsers/csv-parser';

// Helper function to detect data type based on column names
function detectDataType(columns: string[]): {
  dataType: 'transactions' | 'statements' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
} {
  const columnLower = columns.map(c => c.toLowerCase());
  
  // Transaction indicators
  const transactionIndicators = [
    'transaction', 'posting', 'debit', 'credit', 'merchant', 
    'reference', 'memo', 'counterparty', 'payee', 'check'
  ];
  
  // Statement indicators
  const statementIndicators = [
    'opening_balance', 'closing_balance', 'statement_date',
    'available_balance', 'total_credits', 'total_debits',
    'beginning_balance', 'ending_balance', 'daily_balance'
  ];
  
  // Count matches
  const transactionMatches = transactionIndicators.filter(ind =>
    columnLower.some(col => col.includes(ind))
  ).length;
  
  const statementMatches = statementIndicators.filter(ind =>
    columnLower.some(col => col.includes(ind))
  ).length;
  
  // Basic date/amount/description (common to both)
  const hasDate = columnLower.some(col => col.includes('date'));
  const hasAmount = columnLower.some(col => 
    col.includes('amount') || col.includes('balance')
  );
  const hasDescription = columnLower.some(col => 
    col.includes('description') || col.includes('memo') || col.includes('detail')
  );
  
  // Decision logic
  if (statementMatches >= 2) {
    return {
      dataType: 'statements',
      confidence: 'high',
      reason: `Found ${statementMatches} statement indicators (${statementIndicators.filter(ind => 
        columnLower.some(col => col.includes(ind))
      ).join(', ')})`
    };
  }
  
  if (transactionMatches >= 2) {
    return {
      dataType: 'transactions',
      confidence: 'high',
      reason: `Found ${transactionMatches} transaction indicators (${transactionIndicators.filter(ind => 
        columnLower.some(col => col.includes(ind))
      ).join(', ')})`
    };
  }
  
  // If has many rows with date/amount/description, probably transactions
  if (hasDate && hasAmount && hasDescription) {
    return {
      dataType: 'transactions',
      confidence: 'medium',
      reason: 'Has date, amount, and description columns (typical transaction format)'
    };
  }
  
  return {
    dataType: 'unknown',
    confidence: 'low',
    reason: 'Could not determine data type from column names'
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are supported' },
        { status: 400 }
      );
    }
    
    // Read file content
    const content = await file.text();
    
    // Detect columns for the UI to map
    const { columns, sampleRows } = await CSVParser.detectColumns(content);
    
    // Suggest column mapping
    const suggestedMapping = CSVParser.suggestColumnMapping(columns);
    
    // Detect data type (transactions vs statements)
    const detectedDataType = detectDataType(columns);
    
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      columns,
      sampleRows,
      suggestedMapping,
      content, // Send back content for later processing
      detectedDataType,
    });
    
  } catch (error) {
    console.error('CSV upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

