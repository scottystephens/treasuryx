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

async function makeUserSuperAdmin(email: string) {
  console.log(`🔐 Making ${email} a super admin...`);
  
  // Get the user
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('❌ Error listing users:', listError);
    return;
  }
  
  const user = users.users.find(u => u.email === email);
  
  if (!user) {
    console.error(`❌ User not found: ${email}`);
    console.log('\nAvailable users:');
    users.users.forEach(u => console.log(`  - ${u.email}`));
    return;
  }
  
  console.log(`✓ Found user: ${user.id}`);
  
  // Update user metadata to add super admin flag
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      user_metadata: {
        ...user.user_metadata,
        is_super_admin: true,
      },
    }
  );
  
  if (error) {
    console.error('❌ Error updating user:', error);
    return;
  }
  
  console.log('✅ Successfully made user a super admin!');
  console.log(`\nUser ${email} can now access /admin`);
}

// Get email from command line or use default
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: npx tsx scripts/utilities/make-super-admin.ts your-email@example.com');
  process.exit(1);
}

makeUserSuperAdmin(email).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

