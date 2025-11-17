#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

async function verify() {
  console.log('🔍 Verifying Migration 22...\n');

  // Check if view exists
  console.log('1. Checking connection_stats view...');
  const { data: viewData, error: viewError } = await supabase
    .from('connection_stats')
    .select('*')
    .limit(5);

  if (viewError) {
    console.error('❌ View error:', viewError.message);
    return;
  }

  console.log(`✅ View exists! Found ${viewData?.length || 0} connections\n`);

  // Check if columns exist on connections table
  console.log('2. Checking connections table columns...');
  const { data: connData, error: connError } = await supabase
    .from('connections')
    .select('id, sync_schedule, sync_enabled, health_score')
    .limit(1);

  if (connError) {
    console.error('❌ Error checking columns:', connError.message);
  } else {
    console.log('✅ Required columns exist on connections table\n');
  }

  // Check if helper functions exist
  console.log('3. Checking helper functions...');
  const { data: funcData, error: funcError } = await supabase.rpc('get_connections_ready_for_sync', {
    p_schedule: 'daily'
  });

  if (funcError) {
    console.error('❌ Function error:', funcError.message);
  } else {
    console.log(`✅ Helper functions exist! Found ${funcData?.length || 0} connections ready for daily sync\n`);
  }

  console.log('✅ Migration 22 verification complete!');
}

verify().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

