#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listUsers() {
  console.log('👥 Listing all users...\n');
  
  const { data: users, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('❌ Error listing users:', error);
    return;
  }
  
  if (users.users.length === 0) {
    console.log('No users found');
    return;
  }
  
  console.log('Available users:');
  users.users.forEach((u, i) => {
    const isSuperAdmin = u.user_metadata?.is_super_admin === true;
    const badge = isSuperAdmin ? ' [SUPER ADMIN]' : '';
    console.log(`  ${i + 1}. ${u.email}${badge}`);
    console.log(`     ID: ${u.id}`);
    console.log(`     Created: ${new Date(u.created_at).toLocaleString()}`);
    console.log('');
  });
}

listUsers().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

