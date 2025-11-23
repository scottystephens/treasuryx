# Smart Reconnection System

## Overview

The Smart Reconnection System automatically detects when a user is reconnecting to previously connected bank accounts (e.g., after OAuth token expiration or accidental deletion) and intelligently resumes syncing from where they left off.

## Key Features

### 1. **Intelligent Detection** (Multi-Layer Matching)
The system uses a cascading detection strategy with confidence scoring:

- **High Confidence**: Exact external_account_id match, IBAN match, or Institution ID + Account Number
- **Medium Confidence**: Institution name + similar account patterns
- **Low Confidence**: Manual review recommended

### 2. **Automatic Linking**
When reconnection is detected:
- Links new connection to existing accounts
- Preserves all historical transactions
- Updates connection metadata
- Records reconnection event in audit trail

### 3. **Smart Resume Sync**
Instead of re-fetching all historical data:
- Identifies last transaction date
- Only fetches new transactions since that date
- Saves API calls and processing time
- Prevents duplicate transaction imports

### 4. **Audit Trail**
All reconnection events are tracked in `connection_history` table:
- Connection lifecycle events
- Reconnection confidence levels
- Matched accounts count
- Historical transaction count

## How It Works

### Detection Flow

```
1. User Connects Bank Account
   ↓
2. System Fetches Account Metadata
   ↓
3. Reconnection Detection Service Runs
   ├─ Check: External Account IDs (HIGH confidence)
   ├─ Check: Institution + Account Number (HIGH confidence)
   ├─ Check: IBAN (HIGH confidence for EU)
   └─ Check: Institution Name (MEDIUM confidence)
   ↓
4. If Match Found (HIGH confidence):
   ├─ Link new connection to existing accounts
   ├─ Link existing transactions to new connection
   ├─ Get last transaction date
   ├─ Resume sync from that date
   └─ Record reconnection event
   ↓
5. If No Match:
   └─ Treat as new connection (full sync)
```

### Database Schema

#### connection_history Table
```sql
CREATE TABLE connection_history (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  connection_id UUID NOT NULL,
  previous_connection_id UUID,
  event_type TEXT, -- 'reconnection', 'token_refresh', etc.
  event_data JSONB,
  created_at TIMESTAMP,
  created_by UUID
);
```

#### connections Table (New Columns)
```sql
ALTER TABLE connections 
  ADD COLUMN is_reconnection BOOLEAN DEFAULT false,
  ADD COLUMN reconnected_from UUID,
  ADD COLUMN reconnection_confidence TEXT;
```

## API Integration

### Plaid Exchange Token Route
The reconnection logic is integrated into the OAuth exchange flow:

```typescript
// 1. Fetch accounts from provider
const rawAccounts = await provider.fetchRawAccounts(credentials);

// 2. Detect reconnection
const reconnectionMatch = await detectReconnection({
  tenantId,
  providerId,
  institutionId: rawAccounts.institution.id,
  externalAccountIds: rawAccounts.accounts.map(acc => acc.account_id),
  // ... other identifiers
});

// 3. If reconnection detected, link and resume
if (reconnectionMatch.isReconnection) {
  await linkConnectionToAccounts(connectionId, accountIds);
  await linkConnectionToTransactions(connectionId, accountIds);
  
  // Get smart sync start date
  const smartStartDate = await getReconnectionSyncStartDate(accountIds);
  
  // Sync only new data
  await orchestrateSync({
    // ...
    startDate: smartStartDate, // Resume from last sync
  });
}
```

## UI Indicators

### Connection Detail Page
1. **Header Badge**: "🔗 Reconnected" badge with confidence level
2. **Status Message**: "Automatically linked to existing accounts (high confidence)"
3. **Sync Summary**: Shows historical transaction count and smart resume info

Example:
```
🔗 Reconnection Detected (high confidence)
Automatically linked to 3 existing accounts with 450 historical transactions.
Smart sync resumed from your last sync date, avoiding duplicate imports.
```

## Production Benefits

### 1. **Cost Savings**
- Reduces API calls by not re-fetching historical data
- Plaid charges per transaction fetch - this saves money
- Optimizes bandwidth and processing time

### 2. **Better UX**
- Faster reconnection (seconds vs minutes)
- No duplicate transactions
- Seamless experience when tokens expire
- Clear visibility into what happened

### 3. **Data Integrity**
- Preserves historical data
- Maintains transaction continuity
- No data loss on reconnection
- Proper audit trail

### 4. **Reliability**
- Handles token expiration gracefully
- Recovers from accidental deletions
- Multiple matching strategies (fallbacks)
- Confidence scoring for safety

## Testing Scenarios

### Scenario 1: Token Expiration
1. User connects bank account (initial sync imports 500 transactions)
2. OAuth token expires after 90 days
3. User reconnects same bank account
4. **Expected**: System detects reconnection, links to existing data, only fetches ~90 new transactions

### Scenario 2: Accidental Deletion
1. User accidentally deletes connection
2. User reconnects same bank account
3. **Expected**: All historical transactions preserved and linked to new connection

### Scenario 3: New Account at Same Bank
1. User has Chase checking account connected
2. User opens new Chase savings account
3. User reconnects Chase
4. **Expected**: Existing checking preserved, new savings added

## Monitoring & Debugging

### Check Reconnection Events
```sql
SELECT * FROM connection_history 
WHERE event_type = 'reconnection'
ORDER BY created_at DESC;
```

### Check Reconnection Confidence
```sql
SELECT 
  name,
  provider,
  is_reconnection,
  reconnection_confidence,
  total_accounts,
  total_transactions
FROM connections
WHERE is_reconnection = true;
```

### Verify Smart Sync
Check logs for:
```
[Reconnection] 🔗 RECONNECTION DETECTED! Confidence: high
[Reconnection] Found 3 matching accounts
[Reconnection] 450 existing transactions
[Reconnection] Smart sync: Resuming from 2024-11-23 (skipping 450 existing transactions)
```

## Future Enhancements

1. **Manual Review UI**: For medium/low confidence matches, allow user to confirm
2. **Connection Merging**: UI to merge duplicate connections
3. **Token Refresh**: Automatic token refresh before expiration
4. **Email Notifications**: Alert user when token is about to expire
5. **Provider-Specific Logic**: Custom matching for different banking providers

## Files Changed

- `lib/services/reconnection-service.ts` - Core detection logic
- `scripts/migrations/47-add-connection-history.sql` - Database schema
- `app/api/banking/plaid/exchange-token/route.ts` - Integration
- `app/connections/[id]/page.tsx` - UI indicators

## Summary

This production-grade reconnection system ensures that when users reconnect their bank accounts (common with OAuth token expiration), the system:
1. ✅ Detects the reconnection automatically
2. ✅ Links to existing data
3. ✅ Resumes syncing from last point
4. ✅ Avoids duplicates
5. ✅ Provides clear visibility

All while saving API costs and providing a seamless user experience.

