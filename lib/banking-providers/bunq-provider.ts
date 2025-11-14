// Bunq Banking Provider Implementation
// Implements the BankingProvider interface for Bunq

import {
  BankingProvider,
  BankingProviderConfig,
  OAuthTokens,
  ProviderAccount,
  ProviderTransaction,
  ConnectionCredentials,
} from './base-provider';
import * as BunqClient from '../bunq-client';

export class BunqProvider extends BankingProvider {
  config: BankingProviderConfig = {
    providerId: 'bunq',
    displayName: 'Bunq',
    logo: '/logos/bunq.svg',
    color: '#FF6B00',
    description: 'Connect your Bunq account for automatic transaction sync',
    authType: 'oauth',
    supportsSync: true,
    supportedCountries: ['NL', 'DE', 'FR', 'AT', 'IE', 'ES', 'IT', 'BE'],
    website: 'https://www.bunq.com',
    documentationUrl: 'https://doc.bunq.com',
  };

  validateConfiguration(): boolean {
    return BunqClient.validateBunqConfig();
  }

  // =====================================================
  // OAuth Methods
  // =====================================================

  getAuthorizationUrl(state: string): string {
    return BunqClient.getBunqAuthorizationUrl(state);
  }

  async exchangeCodeForToken(code: string): Promise<OAuthTokens> {
    const tokens = await BunqClient.exchangeCodeForToken(code);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: BunqClient.calculateExpirationDate(tokens.expires_in),
      tokenType: tokens.token_type,
      scope: tokens.scope ? tokens.scope.split(' ') : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const tokens = await BunqClient.refreshAccessToken(refreshToken);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: BunqClient.calculateExpirationDate(tokens.expires_in),
      tokenType: tokens.token_type,
    };
  }

  // =====================================================
  // Account Methods
  // =====================================================

  async fetchAccounts(credentials: ConnectionCredentials): Promise<ProviderAccount[]> {
    // Get user info to get user ID
    const userInfo = await BunqClient.getUserInfo(credentials.tokens.accessToken);
    const userId = userInfo.id;

    // Fetch monetary accounts
    const bunqAccounts = await BunqClient.getMonetaryAccounts(
      credentials.tokens.accessToken,
      userId
    );

    // Map to provider accounts
    return bunqAccounts.map((account) => ({
      externalAccountId: account.id.toString(),
      accountName: account.description,
      accountNumber: BunqClient.getPrimaryIban(account.alias) || account.id.toString(),
      accountType: this.mapAccountType(account.status),
      currency: account.currency,
      balance: BunqClient.formatBunqAmount(account.balance),
      iban: BunqClient.getPrimaryIban(account.alias) || undefined,
      status: account.status.toLowerCase() as 'active' | 'inactive' | 'closed',
      metadata: {
        bunq_account_type: 'MonetaryAccountBank',
        bunq_user_id: userId,
        display_name: BunqClient.getDisplayName(account.alias),
        public_uuid: account.public_uuid,
      },
    }));
  }

  async fetchAccount(
    credentials: ConnectionCredentials,
    accountId: string
  ): Promise<ProviderAccount> {
    const userInfo = await BunqClient.getUserInfo(credentials.tokens.accessToken);
    const account = await BunqClient.getMonetaryAccount(
      credentials.tokens.accessToken,
      userInfo.id,
      parseInt(accountId)
    );

    return {
      externalAccountId: account.id.toString(),
      accountName: account.description,
      accountNumber: BunqClient.getPrimaryIban(account.alias) || account.id.toString(),
      accountType: this.mapAccountType(account.status),
      currency: account.currency,
      balance: BunqClient.formatBunqAmount(account.balance),
      iban: BunqClient.getPrimaryIban(account.alias) || undefined,
      status: account.status.toLowerCase() as 'active' | 'inactive' | 'closed',
      metadata: {
        bunq_account_type: 'MonetaryAccountBank',
        bunq_user_id: userInfo.id,
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
    const userInfo = await BunqClient.getUserInfo(credentials.tokens.accessToken);
    const payments = await BunqClient.getPayments(
      credentials.tokens.accessToken,
      userInfo.id,
      parseInt(accountId),
      {
        count: options?.limit || 200,
      }
    );

    // Map payments to provider transactions
    let transactions = payments.map((payment): ProviderTransaction => {
      const amount = BunqClient.formatBunqAmount(payment.amount);
      return {
        externalTransactionId: payment.id.toString(),
        accountId: accountId,
        date: new Date(payment.created),
        amount: Math.abs(amount),
        currency: payment.amount.currency,
        description: payment.description,
        type: amount >= 0 ? 'credit' : 'debit',
        counterpartyName:
          payment.counterparty_alias.name || payment.counterparty_alias.value,
        counterpartyAccount:
          payment.counterparty_alias.type === 'IBAN'
            ? payment.counterparty_alias.value
            : undefined,
        reference: payment.merchant_reference,
        metadata: {
          bunq_payment_type: payment.type,
          bunq_payment_id: payment.id,
          balance_after: BunqClient.formatBunqAmount(payment.balance_after_mutation),
        },
      };
    });

    // Filter by date if provided
    if (options?.startDate) {
      transactions = transactions.filter((tx) => tx.date >= options.startDate!);
    }
    if (options?.endDate) {
      transactions = transactions.filter((tx) => tx.date <= options.endDate!);
    }

    return transactions;
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
    const userInfo = await BunqClient.getUserInfo(credentials.tokens.accessToken);

    return {
      userId: userInfo.id.toString(),
      name:
        userInfo.legal_name ||
        userInfo.display_name ||
        `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim(),
      metadata: {
        public_uuid: userInfo.public_uuid,
        status: userInfo.status,
        aliases: userInfo.alias,
      },
    };
  }

  // =====================================================
  // Utility Methods
  // =====================================================

  getErrorMessage(error: any): string {
    if (error.error_description) {
      return error.error_description;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unknown error occurred with Bunq API';
  }

  mapAccountType(providerAccountType: string): string {
    // Bunq uses status, not account type
    // Map to common account types
    switch (providerAccountType?.toUpperCase()) {
      case 'ACTIVE':
        return 'Checking'; // Default to checking for active accounts
      case 'INACTIVE':
        return 'Savings'; // Inactive might be savings
      case 'CLOSED':
        return 'Closed';
      default:
        return 'Checking';
    }
  }

  formatAmount(amount: string | number): number {
    if (typeof amount === 'number') {
      return amount;
    }
    return parseFloat(amount);
  }
}

// Export singleton instance
export const bunqProvider = new BunqProvider();

