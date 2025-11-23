-- Check what's stored in accounts table for Plaid/Tink accounts
SELECT 
  account_name,
  bank_name,
  provider_id,
  connection_id,
  external_account_id,
  custom_fields->>'institution_name' as institution_name_in_custom_fields,
  custom_fields->>'institution_id' as institution_id,
  created_at
FROM accounts
WHERE provider_id IN ('plaid', 'tink')
ORDER BY created_at DESC;

