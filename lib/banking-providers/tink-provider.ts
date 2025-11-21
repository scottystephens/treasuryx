// Tink Banking Provider Implementation
// Implements the BankingProvider interface for Tink

import {
  BankingProvider,
  BankingProviderConfig,
  OAuthTokens,
  ProviderAccount,
  ProviderTransaction,
  ConnectionCredentials,
} from './base-provider';
import * as TinkClient from '../tink-client';

export class TinkProvider extends BankingProvider {
  config: BankingProviderConfig = {
    providerId: 'tink',
    displayName: 'Tink',
    logo: '/logos/tink.svg',
    color: '#00A8FF',
    description: 'Connect your bank accounts through Tink (3,500+ European banks)',
    authType: 'oauth',
    supportsSync: true,
    supportedCountries: [
      'NL', 'GB', 'DE', 'FR', 'ES', 'IT', 'SE', 'NO', 'DK', 'FI',
      'AT', 'BE', 'CH', 'IE', 'PT', 'PL', 'CZ', 'GR', 'RO', 'HU'
    ],
    website: 'https://www.tink.com',
    documentationUrl: 'https://docs.tink.com',
    integrationType: 'redirect',
  };

  validateConfiguration(): boolean {
    return TinkClient.validateTinkConfig();
  }

  // =====================================================
  // OAuth Methods
  // =====================================================

  getAuthorizationUrl(state: string, metadata?: Record<string, any>): string {
    const market = metadata?.market || 'NL'; // Default to Netherlands
    return TinkClient.getTinkAuthorizationUrl(state, market);
  }

  async exchangeCodeForToken(code: string): Promise<OAuthTokens> {
    const tokens = await TinkClient.exchangeCodeForToken(code);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: TinkClient.calculateExpirationDate(tokens.expires_in),
      tokenType: tokens.token_type,
      scope: tokens.scope ? tokens.scope.split(' ') : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const tokens = await TinkClient.refreshAccessToken(refreshToken);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: TinkClient.calculateExpirationDate(tokens.expires_in),
      tokenType: tokens.token_type,
    };
  }

  // =====================================================
  // Account Methods
  // =====================================================

  async fetchAccounts(credentials: ConnectionCredentials): Promise<ProviderAccount[]> {
    const tinkAccounts = await TinkClient.getAccounts(credentials.tokens.accessToken);

    // Map Tink accounts to provider accounts
    return tinkAccounts.map((account) => {
      // Parse balance from balances.booked.amount.value structure (Tink v2 API)
      let balance = 0;
      let currency = 'EUR';
      
      if (account.balances?.booked?.amount?.value) {
        const amountValue = account.balances.booked.amount.value;
        balance = TinkClient.formatTinkAmount(amountValue);
        currency = account.balances.booked.amount.currencyCode || 'EUR';
      } else if (account.balance) {
        // Fallback to old structure if it exists
        balance = typeof account.balance === 'object' && 'amount' in account.balance
          ? TinkClient.formatTinkAmount(account.balance.amount as any)
          : (account.balance as any);
        currency = account.balance?.currency || 'EUR';
      } else if (account.currencyDenominatedBalance) {
        balance = account.currencyDenominatedBalance.amount || 0;
        currency = account.currencyDenominatedBalance.currencyCode || 'EUR';
      }

      return {
        externalAccountId: account.id,
        accountName: account.name || account.accountNumber || `Account ${account.id}`,
        accountNumber: account.accountNumber || account.identifiers?.accountNumber || account.id,
        accountType: this.mapAccountType(account.type),
        currency,
        balance,
        iban: typeof account.identifiers?.iban === 'object' 
          ? account.identifiers.iban.iban 
          : account.identifiers?.iban,
        bic: typeof account.identifiers?.iban === 'object'
          ? account.identifiers.iban.bic
          : account.identifiers?.bban,
        status: account.closed ? 'closed' : 'active' as 'active' | 'inactive' | 'closed',
        metadata: {
          tink_account_type: account.type,
          financial_institution_id: account.financialInstitutionId,
          holder_name: account.holderName,
          flags: account.flags,
          refreshed: account.refreshed,
          created: account.created,
        },
      };
    });
  }

  async fetchAccount(
    credentials: ConnectionCredentials,
    accountId: string
  ): Promise<ProviderAccount> {
    const account = await TinkClient.getAccount(credentials.tokens.accessToken, accountId);

    // Parse balance from balances.booked.amount.value structure (Tink v2 API)
    let balance = 0;
    let currency = 'EUR';
    
    if (account.balances?.booked?.amount?.value) {
      const amountValue = account.balances.booked.amount.value;
      balance = TinkClient.formatTinkAmount(amountValue);
      currency = account.balances.booked.amount.currencyCode || 'EUR';
    } else if (account.balance) {
      // Fallback to old structure if it exists
      balance = typeof account.balance === 'object' && 'amount' in account.balance
        ? TinkClient.formatTinkAmount(account.balance.amount as any)
        : (account.balance as any);
      currency = account.balance?.currency || 'EUR';
    } else if (account.currencyDenominatedBalance) {
      balance = account.currencyDenominatedBalance.amount || 0;
      currency = account.currencyDenominatedBalance.currencyCode || 'EUR';
    }

    return {
      externalAccountId: account.id,
      accountName: account.name || account.accountNumber || `Account ${account.id}`,
      accountNumber: account.accountNumber || account.identifiers?.accountNumber || account.id,
      accountType: this.mapAccountType(account.type),
      currency,
      balance,
      iban: typeof account.identifiers?.iban === 'object' 
        ? account.identifiers.iban.iban 
        : account.identifiers?.iban,
      bic: typeof account.identifiers?.iban === 'object'
        ? account.identifiers.iban.bic
        : account.identifiers?.bban,
      status: account.closed ? 'closed' : 'active' as 'active' | 'inactive' | 'closed',
      metadata: {
        tink_account_type: account.type,
        financial_institution_id: account.financialInstitutionId,
        holder_name: account.holderName,
      },
    };
  }

  // =====================================================
  // Transaction Methods
  // =====================================================

  async fetchTransactions(
    credentials: ConnectionCredentials,
    accountId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<ProviderTransaction[]> {
    const transactions = await TinkClient.getTransactions(
      credentials.tokens.accessToken,
      accountId,
      {
        startDate: options?.startDate,
        endDate: options?.endDate,
        limit: options?.limit,
      }
    );

    // Map Tink transactions to provider transactions
    return transactions.map((txn): ProviderTransaction => {
      const amount = TinkClient.formatTinkAmount(txn.amount.value);
      const bookedDate = txn.dates?.booked ? new Date(txn.dates.booked) : new Date();
      
      return {
        externalTransactionId: txn.id,
        accountId: accountId,
        date: bookedDate,
        amount: Math.abs(amount),
        currency: txn.amount.currencyCode,
        description: txn.descriptions?.display || txn.descriptions?.original || txn.merchantName || 'Transaction',
        type: amount >= 0 ? 'credit' : 'debit',
        counterpartyName: txn.merchantName,
        counterpartyAccount: undefined, // Tink doesn't always provide this
        reference: txn.reference,
        category: txn.categories?.pfm?.name,
        
        // ✨ ENHANCED METADATA - Store COMPLETE Tink transaction data
        metadata: {
          // Store complete raw transaction for full fidelity and audit trail
          raw_transaction: txn,
          
          // Extracted commonly-used fields for easier querying
          booking_status: txn.bookingStatus,
          value_date: txn.dates?.value,
          original_date: txn.originalDate,
          transaction_type: txn.types?.type,
          transaction_code: txn.types?.code,
          category_id: txn.categories?.pfm?.id,
          category_name: txn.categories?.pfm?.name,
          notes: txn.notes,
          status: txn.status,
          
          // Merchant details
          merchant_name: txn.merchantName,
          merchant_category_code: txn.merchantCategoryCode,
          merchant_location: txn.location,
          
          // Additional identifiers
          provider_transaction_id: txn.identifiers?.providerTransactionId,
          identifiers: txn.identifiers,
          
          // Descriptions
          description_original: txn.descriptions?.original,
          description_display: txn.descriptions?.display,
          
          // Dates for easy access
          date_booked: txn.dates?.booked,
          date_value: txn.dates?.value,
        },
      };
    });
  }

  // =====================================================
  // User Information
  // =====================================================

  async fetchUserInfo(credentials: ConnectionCredentials): Promise<{
    userId: string;
    name: string;
    email?: string;
    metadata?: Record<string, any>;
  }> {
    const userInfo = await TinkClient.getUserInfo(credentials.tokens.accessToken);

    return {
      userId: userInfo.userId,
      name: userInfo.userId, // Tink doesn't provide name directly
      metadata: {
        market: userInfo.market,
        locale: userInfo.locale,
        timeZone: userInfo.timeZone,
      },
    };
  }

  // =====================================================
  // Utility Methods
  // =====================================================

  getErrorMessage(error: any): string {
    // Handle Error instances
    if (error instanceof Error) {
      return error.message;
    }
    
    // Handle error objects with standard fields
    if (error && typeof error === 'object') {
      if (error.error_description) {
        return String(error.error_description);
      }
      if (error.error) {
        return String(error.error);
      }
      if (error.message) {
        return String(error.message);
      }
      // Try to stringify the error object for debugging
      try {
        const stringified = JSON.stringify(error);
        if (stringified !== '{}') {
          return `Tink API error: ${stringified}`;
        }
      } catch {
        // If stringification fails, use toString
        return String(error);
      }
    }
    
    // Fallback for primitive types
    if (error !== null && error !== undefined) {
      return String(error);
    }
    
    return 'An unknown error occurred with Tink API';
  }

  mapAccountType(tinkAccountType: string): string {
    // Map Tink account types to standard types
    const typeMap: Record<string, string> = {
      'CHECKING': 'checking',
      'SAVINGS': 'savings',
      'CREDIT_CARD': 'credit_card',
      'LOAN': 'loan',
      'INVESTMENT': 'investment',
      'MORTGAGE': 'loan',
      'PENSION': 'investment',
    };
    
    return typeMap[tinkAccountType.toUpperCase()] || 'checking';
  }

  formatAmount(amount: string | number): number {
    if (typeof amount === 'number') {
      return amount;
    }
    return parseFloat(amount);
  }
}

// Export singleton instance
export const tinkProvider = new TinkProvider();

