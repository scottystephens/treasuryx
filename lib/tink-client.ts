// Tink API Client for Banking Aggregation
// Documentation: https://docs.tink.com

// =====================================================
// Types and Interfaces
// =====================================================

export interface TinkOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  token_type: string;
  scope?: string;
}

export interface TinkAccount {
  id: string;
  name: string;
  type: string;
  accountNumber?: string;
  balance?: {
    amount: number;
    currency: string;
  };
  balances?: {
    booked?: {
      amount: {
        value: {
          unscaledValue: string;
          scale: string;
        };
        currencyCode: string;
      };
    };
    available?: {
      amount: {
        value: {
          unscaledValue: string;
          scale: string;
        };
        currencyCode: string;
      };
    };
  };
  identifiers?: {
    iban?: string | {
      iban: string;
      bic?: string;
    };
    bban?: string;
    accountNumber?: string;
  };
  holderName?: string;
  closed?: boolean;
  flags?: string[];
  accountExclusion?: string;
  currencyDenominatedBalance?: {
    amount: number;
    currencyCode: string;
  };
  refreshed?: number; // timestamp
  financialInstitutionId?: string;
  created?: number; // timestamp
}

export interface TinkTransaction {
  id: string;
  accountId: string;
  amount: {
    value: {
      unscaledValue: number;
      scale: number;
    };
    currencyCode: string;
  };
  dates: {
    booked?: string; // ISO date
    value?: string; // ISO date
  };
  descriptions?: {
    original?: string;
    display?: string;
  };
  categories?: {
    pfm?: {
      id: string;
      name: string;
    };
  };
  types?: {
    type?: string;
    code?: string;
  };
  merchantName?: string;
  merchantCategoryCode?: string;
  location?: string;
  notes?: string;
  reference?: string;
  bookingStatus?: string;
  originalDate?: string;
  status?: string;
  identifiers?: {
    providerTransactionId?: string;
    [key: string]: any;
  };
  // Allow any additional fields from Tink
  [key: string]: any;
}

export interface TinkUser {
  userId: string;
  market: string;
  locale: string;
  timeZone?: string;
}

// =====================================================
// Tink Client Configuration
// =====================================================

const TINK_CONFIG = {
  clientId: process.env.TINK_CLIENT_ID!,
  clientSecret: process.env.TINK_CLIENT_SECRET!,
  // Trim whitespace and newlines from redirect URI to prevent mismatches
  redirectUri: process.env.TINK_REDIRECT_URI?.trim() || '',
  
  // API URLs
  apiBaseUrl: process.env.TINK_API_BASE_URL || 'https://api.tink.com',
  authorizeUrl: process.env.TINK_OAUTH_AUTHORIZE_URL || 'https://link.tink.com/1.0/authorize',
  tokenUrl: process.env.TINK_OAUTH_TOKEN_URL || 'https://api.tink.com/api/v1/oauth/token',
};

// Validate configuration
export function validateTinkConfig(): boolean {
  const required = ['clientId', 'clientSecret', 'redirectUri'];
  const missing = required.filter(key => !TINK_CONFIG[key as keyof typeof TINK_CONFIG]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing Tink configuration: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}

// =====================================================
// OAuth Functions
// =====================================================

/**
 * Generate OAuth authorization URL for user to grant access
 * Following standard OAuth 2.0 Authorization Code Flow
 * https://docs.tink.com/resources/tutorials/tink-link-web-permanent-users
 */
export function getTinkAuthorizationUrl(state: string, market: string = 'NL'): string {
  if (!validateTinkConfig()) {
    throw new Error('Tink configuration is incomplete');
  }
  
  console.log('🔗 Tink OAuth Configuration:');
  console.log('   Client ID:', TINK_CONFIG.clientId);
  console.log('   Redirect URI:', TINK_CONFIG.redirectUri);
  console.log('   Market:', market);
  
  // Standard OAuth 2.0 parameters only - following industry best practices
  // Note: Tink doesn't support offline_access scope - refresh tokens are provided automatically if available
  const params = new URLSearchParams({
    client_id: TINK_CONFIG.clientId,
    redirect_uri: TINK_CONFIG.redirectUri,
    response_type: 'code',
    scope: 'accounts:read,transactions:read',
    state: state,
    market: market,
  });
  
  const authUrl = `${TINK_CONFIG.authorizeUrl}?${params.toString()}`;
  console.log('   Authorization URL:', authUrl);
  
  return authUrl;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string
): Promise<TinkOAuthTokenResponse> {
  if (!validateTinkConfig()) {
    throw new Error('Tink configuration is incomplete');
  }
  
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: TINK_CONFIG.redirectUri,
    client_id: TINK_CONFIG.clientId,
    client_secret: TINK_CONFIG.clientSecret,
  });
  
  try {
    const response = await fetch(TINK_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error_description: errorText };
      }
      throw new Error(
        `Tink token exchange failed: ${error.error_description || error.error || response.statusText}`
      );
    }
    
    const data: TinkOAuthTokenResponse = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Error exchanging Tink authorization code:', error);
    throw error;
  }
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<TinkOAuthTokenResponse> {
  if (!validateTinkConfig()) {
    throw new Error('Tink configuration is incomplete');
  }
  
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: TINK_CONFIG.clientId,
    client_secret: TINK_CONFIG.clientSecret,
  });
  
  try {
    const response = await fetch(TINK_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tink token refresh failed: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('❌ Error refreshing Tink access token:', error);
    throw error;
  }
}

/**
 * Calculate expiration date from expires_in (seconds)
 */
export function calculateExpirationDate(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}

// =====================================================
// API Request Functions
// =====================================================

/**
 * Make an authenticated API request to Tink
 */
async function tinkApiRequest<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${TINK_CONFIG.apiBaseUrl}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText };
      }
      
      // Properly stringify error object for better error messages
      const errorMessage = error.error_description || error.error || error.message || JSON.stringify(error) || response.statusText;
      console.error(`❌ Tink API Error (${response.status}):`, {
        url,
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
        fullError: error,
      });
      
      throw new Error(`Tink API error: ${errorMessage}`);
    }
    
    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error(`Tink API request failed for ${endpoint}:`, error);
    throw error;
  }
}

// =====================================================
// Account Functions (Tink API v2)
// Documentation: https://docs.tink.com/resources/accounts/list-accounts
// =====================================================

/**
 * Get all accounts for a user using Tink API v2
 */
export async function getAccounts(accessToken: string): Promise<TinkAccount[]> {
  const response = await tinkApiRequest<{ accounts: TinkAccount[] }>(
    '/data/v2/accounts',
    accessToken,
    { method: 'GET' }
  );
  
  // Tink returns accounts directly or wrapped in accounts array
  if (Array.isArray(response)) {
    return response;
  }
  return response.accounts || [];
}

/**
 * Get a specific account using Tink API v2
 */
export async function getAccount(
  accessToken: string,
  accountId: string
): Promise<TinkAccount> {
  const response = await tinkApiRequest<{ account: TinkAccount }>(
    `/data/v2/accounts/${accountId}`,
    accessToken,
    { method: 'GET' }
  );
  
  return response.account;
}

/**
 * Format Tink amount to number
 * Handles both unscaledValue/scale format and direct number
 */
export function formatTinkAmount(
  amount: 
    | { unscaledValue: number | string; scale: number | string } 
    | { value: { unscaledValue: number | string; scale: number | string } }
    | number
): number {
  if (typeof amount === 'number') {
    return amount;
  }
  
  // Handle nested structure: { value: { unscaledValue, scale } }
  if ('value' in amount) {
    const value = amount.value;
    const unscaledValue = typeof value.unscaledValue === 'string' 
      ? parseFloat(value.unscaledValue) 
      : value.unscaledValue;
    const scale = typeof value.scale === 'string'
      ? parseFloat(value.scale)
      : value.scale;
    return unscaledValue / Math.pow(10, scale);
  }
  
  // Handle flat structure: { unscaledValue, scale }
  if ('unscaledValue' in amount) {
    const unscaledValue = typeof amount.unscaledValue === 'string'
      ? parseFloat(amount.unscaledValue)
      : amount.unscaledValue;
    const scale = typeof amount.scale === 'string'
      ? parseFloat(amount.scale)
      : amount.scale;
    return unscaledValue / Math.pow(10, scale);
  }
  
  return 0;
}

// =====================================================
// Transaction Functions (Tink API v2)
// Documentation: https://docs.tink.com/resources/transactions/list-transactions
// =====================================================

/**
 * Tink API v2 Transaction Response
 */
export interface TinkV2TransactionResponse {
  transactions: TinkTransaction[];
  nextPageToken?: string;
}

/**
 * Get transactions for an account using Tink API v2
 * Uses cursor-based pagination for better performance
 */
export async function getTransactions(
  accessToken: string,
  accountId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<TinkTransaction[]> {
  const params = new URLSearchParams();
  
  // Filter by account ID
  params.append('accountIdIn', accountId);
  
  // Date filtering - v2 uses bookedDateGte and bookedDateLte
  if (options?.startDate) {
    // Format: YYYY-MM-DD
    params.append('bookedDateGte', options.startDate.toISOString().split('T')[0]);
  }
  if (options?.endDate) {
    // Format: YYYY-MM-DD
    params.append('bookedDateLte', options.endDate.toISOString().split('T')[0]);
  }
  
  // Page size (max 500 per page in v2)
  const pageSize = Math.min(options?.limit || 500, 500);
  params.append('pageSize', pageSize.toString());
  
  // v2 endpoint
  const endpoint = `/data/v2/transactions?${params.toString()}`;
  
  try {
    const response = await tinkApiRequest<TinkV2TransactionResponse>(
      endpoint,
      accessToken,
      { method: 'GET' }
    );
    
    return response.transactions || [];
  } catch (error) {
    console.error('Error fetching transactions from Tink v2 API:', error);
    throw error;
  }
}

/**
 * Get transactions with automatic pagination support
 * Fetches all transactions across multiple pages if needed
 */
export async function getTransactionsPaginated(
  accessToken: string,
  accountId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    maxPages?: number; // Safety limit
  }
): Promise<TinkTransaction[]> {
  const allTransactions: TinkTransaction[] = [];
  const pageSize = 500; // Max page size
  const maxPages = options?.maxPages || 10; // Safety limit: max 10 pages = 5000 transactions
  const maxTransactions = options?.limit || Number.MAX_SAFE_INTEGER;
  
  let pageToken: string | undefined = undefined;
  let pageCount = 0;
  
  while (pageCount < maxPages && allTransactions.length < maxTransactions) {
    const params = new URLSearchParams();
    
    // Filter by account ID
    params.append('accountIdIn', accountId);
    
    // Date filtering
    if (options?.startDate) {
      params.append('bookedDateGte', options.startDate.toISOString().split('T')[0]);
    }
    if (options?.endDate) {
      params.append('bookedDateLte', options.endDate.toISOString().split('T')[0]);
    }
    
    // Pagination
    params.append('pageSize', pageSize.toString());
    if (pageToken) {
      params.append('pageToken', pageToken);
    }
    
    const endpoint = `/data/v2/transactions?${params.toString()}`;
    
    try {
      const response = await tinkApiRequest<TinkV2TransactionResponse>(
        endpoint,
        accessToken,
        { method: 'GET' }
      );
      
      const transactions = response.transactions || [];
      allTransactions.push(...transactions);
      
      console.log(`📄 Fetched page ${pageCount + 1}: ${transactions.length} transactions (total: ${allTransactions.length})`);
      
      // Check if there are more pages
      pageToken = response.nextPageToken;
      if (!pageToken || transactions.length === 0) {
        break; // No more pages
      }
      
      pageCount++;
      
      // Check if we've reached the limit
      if (allTransactions.length >= maxTransactions) {
        break;
      }
    } catch (error) {
      console.error(`Error fetching page ${pageCount + 1}:`, error);
      // Return what we have so far instead of failing completely
      break;
    }
  }
  
  // Trim to exact limit if specified
  if (options?.limit && allTransactions.length > options.limit) {
    return allTransactions.slice(0, options.limit);
  }
  
  return allTransactions;
}

/**
 * Get all transactions across all accounts
 * v2 API allows fetching multiple accounts at once
 */
export async function getAllTransactions(
  accessToken: string,
  accountIds?: string[], // Optional: filter by specific accounts
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<TinkTransaction[]> {
  const params = new URLSearchParams();
  
  // Filter by account IDs (can pass multiple)
  if (accountIds && accountIds.length > 0) {
    accountIds.forEach(id => params.append('accountIdIn', id));
  }
  
  // Date filtering
  if (options?.startDate) {
    params.append('bookedDateGte', options.startDate.toISOString().split('T')[0]);
  }
  if (options?.endDate) {
    params.append('bookedDateLte', options.endDate.toISOString().split('T')[0]);
  }
  
  // Page size
  const pageSize = Math.min(options?.limit || 500, 500);
  params.append('pageSize', pageSize.toString());
  
  const endpoint = `/data/v2/transactions?${params.toString()}`;
  
  try {
    const response = await tinkApiRequest<TinkV2TransactionResponse>(
      endpoint,
      accessToken,
      { method: 'GET' }
    );
    
    return response.transactions || [];
  } catch (error) {
    console.error('Error fetching all transactions from Tink v2 API:', error);
    throw error;
  }
}

// =====================================================
// User Functions
// =====================================================

/**
 * Get user information
 */
export async function getUserInfo(accessToken: string): Promise<TinkUser> {
  const response = await tinkApiRequest<{ user: TinkUser }>(
    '/api/v1/user',
    accessToken,
    { method: 'GET' }
  );
  
  return response.user;
}

