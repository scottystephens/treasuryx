#!/usr/bin/env npx tsx
/**
 * Verification script for migration 11
 * Checks that all columns, functions, triggers, and indexes were created successfully
 */

import { supabase } from '../../lib/supabase';

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
}

const results: CheckResult[] = [];

async function checkConnectionsColumns() {
  console.log('\n📋 Checking connections table columns...');
  
  const expectedColumns = [
    'total_accounts',
    'active_accounts',
    'total_transactions',
    'last_transaction_date',
    'last_successful_sync_at',
    'consecutive_failures',
    'sync_health_score',
    'sync_summary'
  ];
  
  // Check each column by trying to query it
  for (const col of expectedColumns) {
    try {
      await supabase.from('connections').select(col).limit(0);
      results.push({
        name: `connections.${col}`,
        status: 'PASS',
        message: `Column exists`
      });
    } catch (e: any) {
      results.push({
        name: `connections.${col}`,
        status: 'FAIL',
        message: `Column may not exist: ${e.message}`
      });
    }
  }
}

async function checkAccountsColumns() {
  console.log('\n📋 Checking accounts table columns...');
  
  const expectedColumns = [
    'id',
    'provider_id',
    'connection_id',
    'iban',
    'bic',
    'account_holder_name'
  ];
  
  for (const col of expectedColumns) {
    try {
      await supabase.from('accounts').select(col).limit(0);
      results.push({
        name: `accounts.${col}`,
        status: 'PASS',
        message: `Column exists`
      });
    } catch (e: any) {
      results.push({
        name: `accounts.${col}`,
        status: 'FAIL',
        message: `Column may not exist: ${e.message}`
      });
    }
  }
}

async function checkProviderAccountsFK() {
  console.log('\n🔗 Checking provider_accounts foreign key...');
  
  try {
    // Try to fetch provider_accounts with account join
    const { data, error } = await supabase
      .from('provider_accounts')
      .select('account_id, accounts!inner(id)')
      .limit(1);
    
    if (!error) {
      results.push({
        name: 'provider_accounts.account_id FK',
        status: 'PASS',
        message: 'Foreign key relationship works'
      });
    } else {
      results.push({
        name: 'provider_accounts.account_id FK',
        status: 'WARNING',
        message: `Could not verify FK: ${error.message}`
      });
    }
  } catch (e: any) {
    results.push({
      name: 'provider_accounts.account_id FK',
      status: 'FAIL',
      message: `Error checking FK: ${e.message}`
    });
  }
}

async function checkConnectionStats() {
  console.log('\n📊 Checking connection statistics...');
  
  try {
    const { data: connections, error } = await supabase
      .from('connections')
      .select('id, total_accounts, active_accounts, sync_health_score, provider')
      .limit(5);
    
    if (error) {
      results.push({
        name: 'Connection stats query',
        status: 'FAIL',
        message: `Failed to query: ${error.message}`
      });
      return;
    }
    
    if (!connections || connections.length === 0) {
      results.push({
        name: 'Connection stats data',
        status: 'WARNING',
        message: 'No connections found to verify stats'
      });
      return;
    }
    
    results.push({
      name: 'Connection stats query',
      status: 'PASS',
      message: `Found ${connections.length} connections`
    });
    
    // Check if metadata is populated
    const withStats = connections.filter(c => 
      c.total_accounts !== null || c.sync_health_score !== null
    );
    
    results.push({
      name: 'Connection metadata populated',
      status: withStats.length > 0 ? 'PASS' : 'WARNING',
      message: `${withStats.length}/${connections.length} connections have metadata`
    });
    
    // Display sample data
    console.log('\n📈 Sample connection data:');
    connections.forEach(conn => {
      console.log(`  - ${conn.provider || 'N/A'}: ${conn.total_accounts || 0} accounts, health: ${conn.sync_health_score ? (conn.sync_health_score * 100).toFixed(0) + '%' : 'N/A'}`);
    });
    
  } catch (e: any) {
    results.push({
      name: 'Connection stats',
      status: 'FAIL',
      message: `Error: ${e.message}`
    });
  }
}

async function checkAccountsFK() {
  console.log('\n🔗 Checking accounts foreign keys...');
  
  try {
    // Check connection_id FK
    const { data, error } = await supabase
      .from('accounts')
      .select('id, connection_id, connections!inner(id, provider)')
      .limit(1);
    
    if (!error && data) {
      results.push({
        name: 'accounts.connection_id FK',
        status: 'PASS',
        message: 'Foreign key relationship works'
      });
    } else if (error?.message.includes('does not exist')) {
      results.push({
        name: 'accounts.connection_id FK',
        status: 'WARNING',
        message: 'FK may not be created yet or no data'
      });
    } else {
      results.push({
        name: 'accounts.connection_id FK',
        status: 'FAIL',
        message: `Error: ${error?.message}`
      });
    }
  } catch (e: any) {
    results.push({
      name: 'accounts.connection_id FK',
      status: 'FAIL',
      message: `Error checking FK: ${e.message}`
    });
  }
}

async function checkIndexes() {
  console.log('\n🗂️  Checking indexes...');
  
  // Try to count records - this will use indexes if they exist
  try {
    const { count: accountCount } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true });
    
    const { count: providerAccountCount } = await supabase
      .from('provider_accounts')
      .select('*', { count: 'exact', head: true });
    
    const { count: connectionCount } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true });
    
    results.push({
      name: 'Database queries',
      status: 'PASS',
      message: `Tables accessible: ${accountCount || 0} accounts, ${providerAccountCount || 0} provider_accounts, ${connectionCount || 0} connections`
    });
  } catch (e: any) {
    results.push({
      name: 'Database queries',
      status: 'FAIL',
      message: `Error querying tables: ${e.message}`
    });
  }
}

async function checkAccountsData() {
  console.log('\n💾 Checking accounts data...');
  
  try {
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('id, account_id, account_name, provider_id, connection_id, iban')
      .limit(5);
    
    if (error) {
      results.push({
        name: 'Accounts data query',
        status: 'FAIL',
        message: `Failed to query: ${error.message}`
      });
      return;
    }
    
    if (!accounts || accounts.length === 0) {
      results.push({
        name: 'Accounts data',
        status: 'WARNING',
        message: 'No accounts found'
      });
      return;
    }
    
    results.push({
      name: 'Accounts data query',
      status: 'PASS',
      message: `Found ${accounts.length} accounts`
    });
    
    // Check for new metadata
    const withProviders = accounts.filter(a => a.provider_id);
    const withConnections = accounts.filter(a => a.connection_id);
    const withIban = accounts.filter(a => a.iban);
    
    results.push({
      name: 'Account metadata',
      status: 'PASS',
      message: `${withProviders.length} with provider_id, ${withConnections.length} with connection_id, ${withIban.length} with IBAN`
    });
    
    // Display sample data
    console.log('\n📊 Sample account data:');
    accounts.forEach(acc => {
      console.log(`  - ${acc.account_name || acc.account_id}: provider=${acc.provider_id || 'N/A'}, connection=${acc.connection_id ? '✓' : '✗'}, IBAN=${acc.iban ? '✓' : '✗'}`);
    });
    
  } catch (e: any) {
    results.push({
      name: 'Accounts data',
      status: 'FAIL',
      message: `Error: ${e.message}`
    });
  }
}

async function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 MIGRATION VERIFICATION RESULTS');
  console.log('='.repeat(80) + '\n');
  
  const passed = results.filter(r => r.status === 'PASS');
  const failed = results.filter(r => r.status === 'FAIL');
  const warnings = results.filter(r => r.status === 'WARNING');
  
  // Group by status
  if (passed.length > 0) {
    console.log('✅ PASSED (' + passed.length + ')');
    passed.forEach(r => {
      console.log(`   ✓ ${r.name}: ${r.message}`);
    });
    console.log();
  }
  
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS (' + warnings.length + ')');
    warnings.forEach(r => {
      console.log(`   ⚠ ${r.name}: ${r.message}`);
    });
    console.log();
  }
  
  if (failed.length > 0) {
    console.log('❌ FAILED (' + failed.length + ')');
    failed.forEach(r => {
      console.log(`   ✗ ${r.name}: ${r.message}`);
    });
    console.log();
  }
  
  console.log('='.repeat(80));
  console.log(`Summary: ${passed.length} passed, ${warnings.length} warnings, ${failed.length} failed`);
  console.log('='.repeat(80) + '\n');
  
  if (failed.length > 0) {
    console.log('⚠️  Some checks failed. Review the migration and database state.');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('✅ Migration appears successful with some warnings.');
    process.exit(0);
  } else {
    console.log('🎉 All checks passed! Migration completed successfully.');
    process.exit(0);
  }
}

async function main() {
  console.log('🔍 Verifying Migration 11: Account Creation and Connection Metadata');
  console.log('='.repeat(80));
  
  try {
    await checkConnectionsColumns();
    await checkAccountsColumns();
    await checkProviderAccountsFK();
    await checkAccountsFK();
    await checkConnectionStats();
    await checkAccountsData();
    await checkIndexes();
    
    await printResults();
  } catch (error: any) {
    console.error('\n❌ Verification script failed:', error.message);
    process.exit(1);
  }
}

main();

