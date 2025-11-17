#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

async function fixView() {
  const viewSql = `
CREATE OR REPLACE VIEW connection_stats AS
SELECT 
  c.id as connection_id,
  c.tenant_id,
  c.name as connection_name,
  c.provider,
  c.status,
  c.sync_schedule,
  c.sync_enabled,
  c.health_score,
  c.consecutive_failures,
  c.last_sync_at,
  c.next_sync_at,
  c.last_success_at,
  c.last_error,
  c.last_error_at,
  
  -- Job statistics (using subqueries to avoid GROUP BY issues)
  (SELECT COUNT(*) FROM ingestion_jobs ij WHERE ij.connection_id = c.id AND ij.created_at >= NOW() - INTERVAL '7 days') as jobs_last_7_days,
  (SELECT COUNT(*) FROM ingestion_jobs ij WHERE ij.connection_id = c.id AND ij.created_at >= NOW() - INTERVAL '24 hours') as jobs_last_24_hours,
  (SELECT COUNT(*) FROM ingestion_jobs ij WHERE ij.connection_id = c.id AND ij.status = 'completed') as total_successful_jobs,
  (SELECT COUNT(*) FROM ingestion_jobs ij WHERE ij.connection_id = c.id AND ij.status = 'failed') as total_failed_jobs,
  
  -- Performance metrics
  (SELECT AVG(duration_ms) FROM ingestion_jobs ij WHERE ij.connection_id = c.id AND ij.status = 'completed') as avg_duration_ms,
  COALESCE((SELECT SUM(records_imported) FROM ingestion_jobs ij WHERE ij.connection_id = c.id), 0) as total_records_imported,
  (SELECT MAX(created_at) FROM ingestion_jobs ij WHERE ij.connection_id = c.id) as last_job_at,
  
  -- Account statistics
  (SELECT COUNT(DISTINCT id) FROM provider_accounts pa WHERE pa.connection_id = c.id) as linked_accounts_count
  
FROM connections c;
  `.trim();

  console.log('🔄 Creating/updating connection_stats view...\n');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: viewSql });
    
    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }
    
    if (data && !data.success) {
      console.error('❌ Failed:', data.error);
      return;
    }
    
    console.log('✅ View created successfully!\n');
    
    // Test the view
    console.log('🧪 Testing view...');
    const { data: testData, error: testError } = await supabase
      .from('connection_stats')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('❌ View test failed:', testError.message);
    } else {
      console.log(`✅ View works! Found ${testData?.length || 0} connections`);
    }
    
  } catch (err: any) {
    console.error('❌ Fatal error:', err.message);
  }
}

fixView().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

