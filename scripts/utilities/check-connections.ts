// Utility script to check connections in the database
import { supabase } from '../../lib/supabase';

async function checkConnections() {
  console.log('🔍 Checking connections in database...\n');

  // Check if connection_stats view exists
  console.log('1. Checking connection_stats view...');
  const { data: viewData, error: viewError } = await supabase
    .from('connection_stats')
    .select('*')
    .limit(5);

  if (viewError) {
    console.error('❌ connection_stats view error:', viewError.message);
    console.log('   View might not exist. Checking connections table directly...\n');
  } else {
    console.log(`✅ connection_stats view exists. Found ${viewData?.length || 0} connections\n`);
  }

  // Check connections table directly
  console.log('2. Checking connections table directly...');
  const { data: connections, error: connError } = await supabase
    .from('connections')
    .select('id, name, tenant_id, provider, status, sync_schedule, sync_enabled')
    .limit(10);

  if (connError) {
    console.error('❌ Error querying connections table:', connError.message);
    return;
  }

  console.log(`✅ Found ${connections?.length || 0} connections in database:\n`);

  if (!connections || connections.length === 0) {
    console.log('   ⚠️  No connections found. You need to create connections first.');
    console.log('   Go to /connections page to create a connection.\n');
    return;
  }

  // Display connections
  connections.forEach((conn: any, index: number) => {
    console.log(`   ${index + 1}. ${conn.name}`);
    console.log(`      ID: ${conn.id}`);
    console.log(`      Provider: ${conn.provider || 'CSV/Manual'}`);
    console.log(`      Status: ${conn.status}`);
    console.log(`      Schedule: ${conn.sync_schedule || 'manual'}`);
    console.log(`      Enabled: ${conn.sync_enabled ?? true}`);
    console.log('');
  });

  // Check tenants
  console.log('3. Checking tenants...');
  const tenantIds = [...new Set(connections.map((c: any) => c.tenant_id).filter(Boolean))];
  
  if (tenantIds.length > 0) {
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name')
      .in('id', tenantIds);

    console.log(`✅ Found ${tenants?.length || 0} tenants:\n`);
    tenants?.forEach((t: any) => {
      console.log(`   - ${t.name} (${t.id})`);
    });
  }
}

checkConnections()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

