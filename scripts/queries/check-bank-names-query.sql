-- Query to check what bank names are stored for Plaid/Tink accounts
-- Copy and paste this into Supabase SQL Editor: https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/sql/new

SELECT 
  account_name,
  bank_name,
  provider_id,
  connection_id,
  custom_fields->>'institution_name' as institution_name_stored,
  custom_fields->>'institution_id' as institution_id_stored,
  created_at
FROM accounts
WHERE provider_id IN ('plaid', 'tink')
ORDER BY created_at DESC;

