# Bunq Banking Integration

## Overview

Stratifi integrates with Bunq banking via OAuth 2.0, enabling automatic account and transaction synchronization for European users.

## Status

✅ **Production Ready** - Fully implemented and tested

## Quick Start

### 1. Prerequisites

- Bunq Developer account ([https://developer.bunq.com](https://developer.bunq.com))
- OAuth Client credentials (Client ID & Secret)
- Production or Sandbox environment access

### 2. Configuration

Add to environment variables:

```bash
BUNQ_CLIENT_ID=your_client_id
BUNQ_CLIENT_SECRET=your_client_secret
BUNQ_REDIRECT_URI=https://yourdomain.com/api/banking/bunq/callback
BUNQ_ENVIRONMENT=production  # or 'sandbox'
```

### 3. Database Migration

Run migration 06:

```bash
# Via Supabase SQL Editor
# Copy contents of scripts/migrations/06-add-bunq-oauth-support.sql
```

### 4. Test Connection

1. Navigate to Connections → New Connection
2. Select "Bunq Banking"
3. Authorize with Bunq
4. Click "Sync" to import accounts and transactions

## Features

- ✅ **OAuth 2.0 Authentication** - Secure user-authorized access
- ✅ **Automatic Account Sync** - Import all monetary accounts
- ✅ **Transaction Sync** - Fetch payments and transactions
- ✅ **Token Management** - Automatic refresh
- ✅ **Multi-Account Support** - Handle multiple accounts per user
- ✅ **Deduplication** - Prevent duplicate imports
- ✅ **Audit Logging** - Track all sync operations

## User Flow

1. **Connect**: User clicks "Connect with Bunq" → OAuth authorization → Redirected back
2. **Sync Accounts**: Click sync button → Accounts fetched → Created in Stratifi
3. **Sync Transactions**: Automatic with account sync → Transactions imported → Displayed in UI

## API Endpoints

### OAuth Flow

- **POST** `/api/banking/bunq/authorize` - Initiate OAuth
- **GET** `/api/banking/bunq/callback` - Handle OAuth callback

### Data Sync (Generic Provider Endpoints)

- **POST** `/api/banking/bunq/sync` - Sync accounts and transactions

## Database Schema

### Tables Created

- `bunq_oauth_tokens` - OAuth token storage
- `bunq_accounts` - Bunq account mappings
- `bunq_transactions_staging` - Transaction staging

All tables have Row-Level Security (RLS) enabled.

## Security

- ✅ OAuth state validation (CSRF protection)
- ✅ Secure token storage
- ✅ Row-level security
- ✅ Automatic token refresh
- ✅ Read-only access
- ✅ User-revocable access

## Testing

### Sandbox Testing

```bash
BUNQ_ENVIRONMENT=sandbox
# Create sandbox user in Bunq Developer Portal
# Test full OAuth and sync flow
```

### Production Testing

```bash
BUNQ_ENVIRONMENT=production
# Test with real Bunq account
# Monitor for 24-48 hours
```

## Troubleshooting

### Common Errors

**"Token expired"**
- User needs to reconnect account
- Delete connection and recreate

**"Invalid OAuth state"**
- Connection creation timed out
- Restart connection process

**"Rate limit exceeded"**
- Wait 5 minutes before syncing again
- Bunq enforces rate limits per user

**"Configuration incomplete"**
- Verify all environment variables are set
- Check Client ID and Secret

## Monitoring

### Metrics to Track

- Number of active Bunq connections
- Failed OAuth attempts
- Failed sync jobs
- Token refresh failures
- API rate limit hits

### Logs to Monitor

- OAuth callback errors
- Sync operation errors
- Token refresh failures
- Bunq API errors

## Architecture

### Data Flow

```
User Authorization → Bunq OAuth → Token Storage
                                        ↓
                              Connection Active
                                        ↓
                   User Clicks Sync → Fetch Accounts
                                        ↓
                              Create Stratifi Accounts
                                        ↓
                              Fetch Transactions
                                        ↓
                            Store in Staging Table
                                        ↓
                           Import to Main Transactions
                                        ↓
                              Display in UI
```

### Provider Implementation

Bunq uses the generic `BankingProvider` interface with specific implementations for:
- OAuth flow management
- Account fetching
- Transaction fetching
- Token refresh

**Key Files:**
- `lib/banking-providers/bunq-provider.ts` - Provider implementation
- `lib/bunq-client.ts` - Bunq API client
- `app/api/banking/[provider]/callback/route.ts` - OAuth callback
- `app/api/banking/[provider]/sync/route.ts` - Data sync

## Future Enhancements

- [ ] Scheduled automatic syncs (cron jobs)
- [ ] Webhook support for real-time updates
- [ ] Payment initiation (requires PSD2 license)
- [ ] Transaction categorization
- [ ] Multi-currency conversion
- [ ] Support for Bunq savings goals

## Support

- **Bunq API Docs**: https://doc.bunq.com
- **Developer Portal**: https://developer.bunq.com
- **Support Email**: support@bunq.com

## Compliance

- **PSD2 Compliant**: Read-only access to user data
- **GDPR Compliant**: Users can revoke access anytime
- **User Controlled**: Users maintain full control of their accounts
- **Data Retention**: As per your privacy policy

---

**Implementation Date**: November 14, 2025  
**Status**: ✅ Production Ready  
**Last Updated**: November 16, 2025

