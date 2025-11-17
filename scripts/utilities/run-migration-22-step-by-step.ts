#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

// Split migration into logical sections
const sections = [
  {
    name: 'STEP 1: Enhance Connections Table',
    start: '-- =====================================================\n-- STEP 1:',
    end: '-- =====================================================\n-- STEP 2:',
  },
  {
    name: 'STEP 2: Provider API Usage Tracking',
    start: '-- =====================================================\n-- STEP 2:',
    end: '-- =====================================================\n-- STEP 3:',
  },
  {
    name: 'STEP 3: System Health Metrics',
    start: '-- =====================================================\n-- STEP 3:',
    end: '-- =====================================================\n-- STEP 4:',
  },
  {
    name: 'STEP 4: Sync Job Performance Tracking',
    start: '-- =====================================================\n-- STEP 4:',
    end: '-- =====================================================\n-- STEP 5:',
  },
  {
    name: 'STEP 5: Connection Health Calculation Function',
    start: '-- =====================================================\n-- STEP 5:',
    end: '-- =====================================================\n-- STEP 6:',
  },
  {
    name: 'STEP 6: Automatic Health Update Trigger',
    start: '-- =====================================================\n-- STEP 6:',
    end: '-- =====================================================\n-- STEP 7:',
  },
  {
    name: 'STEP 7: Connection Statistics View',
    start: '-- =====================================================\n-- STEP 7:',
    end: '-- =====================================================\n-- STEP 8:',
  },
  {
    name: 'STEP 8: RLS Policies',
    start: '-- =====================================================\n-- STEP 8:',
    end: '-- =====================================================\n-- STEP 9:',
  },
  {
    name: 'STEP 9: Helper Functions',
    start: '-- =====================================================\n-- STEP 9:',
    end: '-- =====================================================\n-- STEP 10:',
  },
  {
    name: 'STEP 10: Initial Data Population',
    start: '-- =====================================================\n-- STEP 10:',
    end: '-- END OF MIGRATION',
  },
];

async function runSection(sql: string, sectionName: string) {
  console.log(`\n📦 Running: ${sectionName}`);
  console.log('─'.repeat(60));
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return false;
    }
    
    if (data && !data.success) {
      // Check if it's an "already exists" error (which is ok)
      if (data.error && (
        data.error.includes('already exists') ||
        data.error.includes('duplicate') ||
        data.error.includes('IF NOT EXISTS')
      )) {
        console.log(`✓ Completed (some items already exist - ok)`);
        return true;
      }
      console.error(`❌ Failed: ${data.error}`);
      return false;
    }
    
    console.log(`✅ Completed successfully`);
    return true;
  } catch (err: any) {
    console.error(`❌ Fatal error: ${err.message}`);
    return false;
  }
}

async function runMigration22() {
  console.log('📊 Running Migration 22: Add Orchestration Tables');
  console.log(`🔗 Database: ${supabaseUrl}\n`);

  const migrationFile = resolve(process.cwd(), 'scripts/migrations/22-add-orchestration-tables.sql');
  const fullSql = readFileSync(migrationFile, 'utf-8');
  
  // Extract sections
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const startIdx = fullSql.indexOf(section.start);
    const endIdx = i < sections.length - 1 
      ? fullSql.indexOf(sections[i + 1].start)
      : fullSql.length;
    
    if (startIdx === -1) {
      console.log(`⚠️  Section "${section.name}" not found, skipping...`);
      continue;
    }
    
    const sectionSql = fullSql.substring(startIdx, endIdx).trim();
    
    if (!sectionSql) {
      console.log(`⚠️  Section "${section.name}" is empty, skipping...`);
      continue;
    }
    
    const success = await runSection(sectionSql, section.name);
    
    if (!success && !sectionSql.includes('IF NOT EXISTS') && !sectionSql.includes('CREATE OR REPLACE')) {
      console.log(`\n⚠️  Section failed. Continuing with next section...`);
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ Migration 22 completed!');
  console.log('═'.repeat(60));
}

runMigration22().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

