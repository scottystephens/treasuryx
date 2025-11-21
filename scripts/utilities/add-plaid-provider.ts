// Add Plaid to banking_providers table
// This script adds Plaid as a valid provider in the database

import { supabase } from '../../lib/supabase';

async function addPlaidProvider() {
  console.log('🚀 Adding Plaid to banking_providers table...');

  try {
    // Insert or update Plaid in banking_providers
    const { data, error } = await supabase
      .from('banking_providers')
      .upsert({
        id: 'plaid',
        display_name: 'Plaid (Global Banks)',
        auth_type: 'oauth',
        logo_url: '/logos/plaid.svg',
        color: '#000000',
        description: 'Connect with thousands of banks worldwide securely.',
        website: 'https://plaid.com',
        supported_countries: ['US', 'CA', 'GB', 'IE', 'FR', 'ES', 'NL', 'DE', 'IT', 'PL', 'BE', 'AT', 'DK', 'FI', 'NO', 'SE', 'EE', 'LT', 'LV'],
        enabled: true,
        config: {
          integration_type: 'plaid_link',
          products: ['transactions'],
          sandbox_enabled: true
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('❌ Error adding Plaid provider:', error);
      throw error;
    }

    console.log('✅ Plaid provider added successfully:', data);

    // Verify it was added
    const { data: providers, error: verifyError } = await supabase
      .from('banking_providers')
      .select('*')
      .eq('id', 'plaid')
      .single();

    if (verifyError) {
      console.error('❌ Error verifying Plaid provider:', verifyError);
      throw verifyError;
    }

    console.log('✅ Verification successful. Plaid provider in database:', providers);
    console.log('\n🎉 Done! Plaid is now registered in the database.');
    console.log('You can now test the Plaid OAuth flow.');

  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

addPlaidProvider();

