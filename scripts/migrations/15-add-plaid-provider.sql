-- Add Plaid to banking_providers table
-- This allows provider_tokens to reference 'plaid' as a valid provider_id

INSERT INTO banking_providers (
    id,
    display_name,
    auth_type,
    logo_url,
    color,
    description,
    website,
    supported_countries,
    enabled,
    config
)
VALUES (
    'plaid',
    'Plaid (Global Banks)',
    'oauth',
    '/logos/plaid.svg',
    '#000000',
    'Connect with thousands of banks worldwide securely.',
    'https://plaid.com',
    ARRAY['US', 'CA', 'GB', 'IE', 'FR', 'ES', 'NL', 'DE', 'IT', 'PL', 'BE', 'AT', 'DK', 'FI', 'NO', 'SE', 'EE', 'LT', 'LV'],
    true,
    '{
        "integration_type": "plaid_link",
        "products": ["transactions"],
        "sandbox_enabled": true
    }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    supported_countries = EXCLUDED.supported_countries,
    config = EXCLUDED.config,
    updated_at = NOW();

