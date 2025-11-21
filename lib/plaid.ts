import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;

// Default to sandbox if not specified
const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox') as keyof typeof PlaidEnvironments;

if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  console.warn('Plaid credentials not configured. Provider will be disabled.');
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID || '',
      'PLAID-SECRET': PLAID_SECRET || '',
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export const PLAID_PRODUCTS = (process.env.PLAID_PRODUCTS || 'transactions').split(',');
export const PLAID_COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || 'US,CA').split(',');

