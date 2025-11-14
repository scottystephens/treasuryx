# Bunq Banking API Integration Guide

## Overview

Stratifi now supports direct integration with Bunq banking through OAuth 2.0, allowing automatic synchronization of accounts and transactions from Bunq monetary accounts.

## Features

✅ **OAuth 2.0 Authentication** - Secure, user-authorized access  
✅ **Automatic Account Sync** - Import all monetary accounts from Bunq  
✅ **Transaction Sync** - Automatically fetch and import transactions  
✅ **Token Management** - Automatic token refresh when expired  
✅ **Multi-Account Support** - Handle multiple Bunq accounts per tenant  
✅ **Deduplication** - Prevent duplicate transaction imports  
✅ **Audit Logging** - Track all sync operations  

## Prerequisites

### 1. Bunq Developer Account

1. Go to [https://developer.bunq.com](https://developer.bunq.com)
2. Create a developer account
3. Create an OAuth Client in the Developer Portal
4. Note down your:
   - Client ID
   - Client Secret
   - Redirect URI (must match your application URL)

### 2. Environment Variables

Add the following to your `.env.local` or production environment:

```bash
# Bunq OAuth Configuration
BUNQ_CLIENT_ID=your_client_id_here
BUNQ_CLIENT_SECRET=your_client_secret_here
BUNQ_REDIRECT_URI=https://yourdomain.com/api/connections/bunq/callback
BUNQ_ENVIRONMENT=production  # or 'sandbox' for testing

# Bunq API URLs (optional - defaults provided)
BUNQ_OAUTH_AUTHORIZE_URL=https://oauth.bunq.com/auth
BUNQ_OAUTH_TOKEN_URL=https://api.oauth.bunq.com/v1/token
BUNQ_API_BASE_URL=https://api.bunq.com/v1
```

### 3. Database Migration

Run the Bunq OAuth migration to set up required tables:

```bash
# Using Supabase CLI
supabase db push scripts/migrations/06-add-bunq-oauth-support.sql

# Or manually via Supabase Dashboard
# Copy and execute the SQL from scripts/migrations/06-add-bunq-oauth-support.sql
```

This creates:
- `bunq_oauth_tokens` - Stores OAuth tokens and API keys
- `bunq_accounts` - Maps Bunq accounts to Stratifi accounts
- `bunq_transactions_staging` - Temporary storage for imported transactions
- Required RLS policies and helper functions

## User Flow

### Connecting a Bunq Account

1. User navigates to **Connections** → **New Connection**
2. Selects **Bunq Banking** option
3. Enters a connection name (e.g., "My Bunq Business Account")
4. Clicks **Connect with Bunq**
5. Redirected to Bunq's OAuth page
6. Logs in with Bunq credentials
7. Authorizes Stratifi to access their account (read-only)
8. Redirected back to Stratifi with connection established

### Syncing Data

#### Initial Sync
After connecting, users should:
1. Click the **Sync** button on the connection
2. This will:
   - Fetch all monetary accounts from Bunq
   - Create corresponding accounts in Stratifi
   - Fetch recent transactions (last 200 by default)
   - Import transactions into Stratifi

#### Ongoing Syncs
- Users can click the sync button anytime to fetch new transactions
- Token refresh is automatic if expired
- Failed syncs show error messages to the user

## API Endpoints

### 1. Initiate OAuth Flow
**POST** `/api/connections/bunq/authorize`

Creates a connection and returns OAuth authorization URL.

**Request Body:**
```json
{
  "tenantId": "uuid",
  "connectionName": "My Bunq Account",
  "accountId": "optional-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "connectionId": "uuid",
  "authorizationUrl": "https://oauth.bunq.com/auth?...",
  "message": "Connection created. Redirect user to authorization URL."
}
```

### 2. OAuth Callback
**GET** `/api/connections/bunq/callback`

Handles the OAuth callback from Bunq.

**Query Parameters:**
- `code` - Authorization code from Bunq
- `state` - Security state parameter

**Flow:**
1. Exchanges code for access token
2. Fetches Bunq user info
3. Stores tokens in database
4. Updates connection status to 'active'
5. Redirects to connection details page

### 3. Sync Accounts
**POST** `/api/connections/bunq/sync-accounts`

Fetches monetary accounts from Bunq and creates/updates them in Stratifi.

**Request Body:**
```json
{
  "connectionId": "uuid",
  "tenantId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Synced 3 accounts",
  "accounts": [
    {
      "id": "uuid",
      "bunq_account_id": 12345,
      "stratifi_account_id": "uuid",
      "action": "created"
    }
  ]
}
```

### 4. Sync Transactions
**POST** `/api/connections/bunq/sync-transactions`

Fetches payments/transactions from Bunq and imports them.

**Request Body:**
```json
{
  "connectionId": "uuid",
  "tenantId": "uuid",
  "count": 200  // optional, defaults to 200
}
```

**Response:**
```json
{
  "success": true,
  "message": "Synced transactions from 3 accounts",
  "summary": {
    "fetched": 150,
    "processed": 150,
    "imported": 145,
    "skipped": 5,
    "failed": 0
  },
  "job_id": "uuid"
}
```

## Database Schema

### bunq_oauth_tokens
Stores OAuth tokens and authentication data.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Tenant reference |
| connection_id | UUID | Connection reference |
| access_token | TEXT | OAuth access token (encrypted) |
| refresh_token | TEXT | Refresh token |
| expires_at | TIMESTAMP | Token expiration |
| bunq_user_id | TEXT | Bunq user ID |
| bunq_environment | TEXT | 'sandbox' or 'production' |

### bunq_accounts
Maps Bunq accounts to Stratifi accounts.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Tenant reference |
| connection_id | UUID | Connection reference |
| account_id | UUID | Linked Stratifi account |
| bunq_monetary_account_id | TEXT | Bunq account ID |
| iban | TEXT | Account IBAN |
| currency | TEXT | Account currency |
| balance | DECIMAL | Current balance |
| status | TEXT | 'active', 'inactive', 'closed' |

### bunq_transactions_staging
Temporary storage for transactions during import.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| bunq_payment_id | TEXT | Bunq payment ID |
| amount | DECIMAL | Transaction amount |
| description | TEXT | Transaction description |
| transaction_date | TIMESTAMP | Transaction date |
| imported_to_transactions | BOOLEAN | Import status |
| raw_data | JSONB | Full Bunq payment data |

## Security Features

### OAuth State Verification
- Random state parameter generated for each OAuth flow
- Validated on callback to prevent CSRF attacks
- One-time use (cleared after successful authorization)

### Token Storage
- Access tokens stored securely in database
- Refresh tokens used to renew expired access tokens
- Tokens never exposed to frontend

### Row-Level Security (RLS)
- All Bunq tables protected with RLS policies
- Users can only access data for their tenants
- Role-based access (owner, admin, editor, viewer)

### PSD2 Compliance
- Read-only access to user data
- No payment initiation capabilities
- User can revoke access anytime in Bunq app

## Error Handling

### Common Errors and Solutions

#### 1. Token Expired
**Error:** "Access token expired and no refresh token available"

**Solution:**
- User needs to reconnect their Bunq account
- Click "Delete" on the connection and create a new one

#### 2. Invalid OAuth State
**Error:** "Invalid OAuth state. Please try again."

**Solution:**
- Connection creation may have timed out
- Start the connection process again from the beginning

#### 3. API Rate Limiting
**Error:** "Bunq API error: Rate limit exceeded"

**Solution:**
- Wait a few minutes before syncing again
- Bunq has rate limits per user/application

#### 4. Missing Configuration
**Error:** "Bunq configuration is incomplete"

**Solution:**
- Verify all required environment variables are set
- Check BUNQ_CLIENT_ID and BUNQ_CLIENT_SECRET

## Testing

### Sandbox Environment

For development and testing:

1. Set `BUNQ_ENVIRONMENT=sandbox` in your `.env.local`
2. Create a sandbox user in Bunq Developer Portal
3. Use sandbox credentials to test the integration
4. Sandbox is free and doesn't affect real accounts

### Production Environment

Before going live:

1. Set `BUNQ_ENVIRONMENT=production`
2. Update redirect URI to production domain
3. Test with a real Bunq account
4. Monitor logs for errors

## Monitoring and Maintenance

### Logs to Monitor

1. **OAuth Failures:** Check callback route logs
2. **Sync Errors:** Monitor sync-accounts and sync-transactions endpoints
3. **Token Refresh:** Watch for refresh failures
4. **API Errors:** Bunq API error responses

### Regular Maintenance

- Review ingestion_jobs table for failed syncs
- Clean up old bunq_transactions_staging records
- Monitor token expiration dates
- Update Bunq client library if API changes

## UI Components

### BunqConnectButton
Reusable component for initiating Bunq OAuth flow.

```tsx
import { BunqConnectButton } from '@/components/bunq-connect-button';

<BunqConnectButton
  tenantId={currentTenant.id}
  connectionName="My Bunq Account"
  accountId={accountId} // optional
  onSuccess={() => console.log('Connected!')}
  onError={(error) => console.error(error)}
/>
```

### Connection Card
The connections page automatically displays Bunq connections with:
- Orange Bunq icon
- Sync button for manual refresh
- Last sync timestamp
- Connection status

## Future Enhancements

Possible future features:
- [ ] Automatic scheduled syncs
- [ ] Webhook support for real-time updates
- [ ] Payment initiation (requires PSD2 license)
- [ ] Multi-currency conversion
- [ ] Transaction categorization using Bunq categories
- [ ] Support for Bunq savings goals

## Support

For issues or questions:
1. Check Bunq API documentation: https://doc.bunq.com
2. Review error logs in Supabase Dashboard
3. Check ingestion_jobs table for sync failures
4. Test with sandbox environment first

## License and Compliance

- This integration uses Bunq's OAuth API
- Read-only access to user data
- Users maintain full control over their Bunq accounts
- Data stored according to your privacy policy
- GDPR compliant (users can delete connections anytime)

