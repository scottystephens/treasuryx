#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const testTenantId = '9f5b2d41-c4e7-41d2-ad2e-9576a1a6ae6e'; // Test Organization
const testUserId = 'fc5df56b-8551-478c-8efb-3c9e62e49443'; // test@treasuryx.com

const testAccounts = [
  {
    tenant_id: testTenantId,
    account_name: 'Main Operating Account',
    account_number: 'CHK-1001234567',
    account_type: 'checking',
    account_status: 'active',
    bank_name: 'Chase Bank',
    bank_identifier: '021000021', // Chase routing number
    branch_name: 'New York Main Branch',
    currency: 'USD',
    opening_date: '2023-01-01',
    current_balance: 125000.00,
    available_balance: 125000.00,
    overdraft_limit: 10000.00,
    business_unit: 'Corporate',
    gl_account_code: '1000-100-001',
    purpose: 'Primary operating account for day-to-day business expenses',
    sync_enabled: true,
    custom_fields: {
      custom_1: { label: 'Account Owner', value: 'Treasury Department' },
      custom_2: { label: 'Review Frequency', value: 'Daily' },
    },
    notes: 'Main operational account - monitor daily',
    tags: ['primary', 'operating', 'usd'],
    created_by: testUserId,
  },
  {
    tenant_id: testTenantId,
    account_name: 'Savings Reserve Account',
    account_number: 'SAV-3001234567',
    account_type: 'savings',
    account_status: 'active',
    bank_name: 'Chase Bank',
    bank_identifier: '021000021',
    currency: 'USD',
    opening_date: '2023-01-01',
    current_balance: 500000.00,
    available_balance: 500000.00,
    minimum_balance: 50000.00,
    interest_rate: 0.0425, // 4.25%
    business_unit: 'Corporate',
    gl_account_code: '1000-200-001',
    purpose: 'Emergency fund and strategic reserves',
    custom_fields: {
      custom_1: { label: 'Maturity Date', value: '2026-12-31' },
      custom_2: { label: 'Interest Payment', value: 'Quarterly' },
    },
    notes: 'Reserve account - minimum balance $50,000',
    tags: ['savings', 'reserve', 'usd'],
    created_by: testUserId,
  },
  {
    tenant_id: testTenantId,
    account_name: 'EUR Operations Account',
    account_number: 'CHK-4001234567',
    account_type: 'checking',
    account_status: 'active',
    bank_name: 'Deutsche Bank',
    bank_identifier: 'DEUTDEFF', // SWIFT code
    branch_name: 'Frankfurt Main',
    currency: 'EUR',
    opening_date: '2023-01-01',
    current_balance: 75000.00,
    available_balance: 75000.00,
    business_unit: 'Europe',
    gl_account_code: '1000-100-002',
    purpose: 'European operations and supplier payments',
    sync_enabled: true,
    custom_fields: {
      custom_1: { label: 'Region', value: 'EMEA' },
      custom_2: { label: 'Currency Hedge', value: 'Yes' },
    },
    notes: 'For European operations only',
    tags: ['operating', 'eur', 'europe'],
    created_by: testUserId,
  },
  {
    tenant_id: testTenantId,
    account_name: 'Business Credit Card',
    account_number: 'CC-5001234567',
    account_type: 'credit_card',
    account_status: 'active',
    bank_name: 'American Express',
    currency: 'USD',
    opening_date: '2023-01-01',
    current_balance: -8500.00, // Negative = owed
    credit_limit: 50000.00,
    business_unit: 'Corporate',
    gl_account_code: '2000-100-001',
    purpose: 'Corporate expenses and employee reimbursements',
    custom_fields: {
      custom_1: { label: 'Statement Day', value: '15th of month' },
      custom_2: { label: 'Rewards Program', value: 'Membership Rewards' },
    },
    notes: 'Pay in full monthly - due on 10th',
    tags: ['credit', 'corporate', 'usd'],
    created_by: testUserId,
  },
];

async function createTestAccounts() {
  try {
    console.log('🏦 Creating test accounts for Test Organization...');
    console.log('');
    
    // Delete existing test accounts first
    const existingResponse = await fetch(
      `${supabaseUrl}/rest/v1/accounts?tenant_id=eq.${testTenantId}`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        }
      }
    );
    
    const existingAccounts = await existingResponse.json();
    
    if (existingAccounts && existingAccounts.length > 0) {
      console.log(`🗑️  Found ${existingAccounts.length} existing accounts - deleting...`);
      
      await fetch(
        `${supabaseUrl}/rest/v1/accounts?tenant_id=eq.${testTenantId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          }
        }
      );
      
      console.log('✓ Deleted existing accounts');
      console.log('');
    }
    
    // Create new test accounts
    for (const account of testAccounts) {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/accounts`,
        {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(account)
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Failed to create ${account.account_name}:`, error);
        continue;
      }
      
      const created = await response.json();
      const acc = Array.isArray(created) ? created[0] : created;
      
      console.log(`✓ Created: ${acc.account_name}`);
      console.log(`   Type: ${acc.account_type}`);
      console.log(`   Balance: ${acc.currency} ${acc.current_balance.toLocaleString()}`);
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ TEST ACCOUNTS CREATED!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`Total accounts: ${testAccounts.length}`);
    console.log('');
    console.log('Accounts:');
    console.log('  1. Main Operating Account (USD Checking) - $125,000');
    console.log('  2. Savings Reserve Account (USD Savings) - $500,000');
    console.log('  3. EUR Operations Account (EUR Checking) - €75,000');
    console.log('  4. Business Credit Card (USD Credit) - -$8,500');
    console.log('');
    console.log('You can now:');
    console.log('  • View accounts at: /accounts');
    console.log('  • Link CSV imports to these accounts');
    console.log('  • Track transactions per account');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTestAccounts();

