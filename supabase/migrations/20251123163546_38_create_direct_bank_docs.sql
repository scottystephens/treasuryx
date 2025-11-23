-- 38-create-direct-bank-docs.sql
-- Stores documentation links for direct bank credential fields

CREATE TABLE IF NOT EXISTS direct_bank_provider_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id TEXT NOT NULL,
    field_key TEXT NOT NULL,
    doc_label TEXT NOT NULL,
    doc_url TEXT NOT NULL,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider_id, field_key)
);

INSERT INTO direct_bank_provider_docs (provider_id, field_key, doc_label, doc_url, instructions)
VALUES
    (
        'standard_bank_sa',
        'appId',
        'Register an app in Standard Bank OneHub',
        'https://www.standardbank.co.za/southafrica/business/products-and-services/business-solutions/specialised/bank-feeds',
        'Create a Bank Feeds integration in the OneHub Marketplace to retrieve your App ID (Client ID).'
    ),
    (
        'standard_bank_sa',
        'clientSecret',
        'Retrieve App Secret from OneHub',
        'https://www.standardbank.co.za/southafrica/business/products-and-services/business-solutions/specialised/bank-feeds',
        'Within the same OneHub app, generate the client secret used for OAuth client-credentials.'
    ),
    (
        'standard_bank_sa',
        'subscriptionKeyBalances',
        'Balance Enquiry Subscription Key',
        'https://corporateandinvestment.standardbank.com/cib/global/products-and-services/onehub/api-marketplace',
        'Subscribe to the Balance Enquiry API product in OneHub. Each API product issues its own Ocp-Apim-Subscription-Key.'
    ),
    (
        'standard_bank_sa',
        'subscriptionKeyTransactions',
        'Statements/Transactions Subscription Key',
        'https://corporateandinvestment.standardbank.com/cib/global/products-and-services/onehub/api-marketplace',
        'Subscribe to the Statements/Transactions API product in OneHub. This key is separate from the Balance Enquiry key.'
    ),
    (
        'standard_bank_sa',
        'subscriptionKeyPayments',
        'Payment Initiation Subscription Key (Optional)',
        'https://corporateandinvestment.standardbank.com/cib/global/products-and-services/onehub/api-marketplace',
        'Only required if you plan to initiate payments. Subscribe to the Payment Initiation API product to receive this key.'
    )
ON CONFLICT (provider_id, field_key) DO NOTHING;

