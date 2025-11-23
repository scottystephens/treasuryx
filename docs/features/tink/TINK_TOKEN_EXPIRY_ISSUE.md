# Tink OAuth Token Expiry Issue - Analysis & Solution

## Problem

**Symptom:** Tink OAuth tokens expire after 2 hours with NO refresh tokens provided

**Impact:** Users must re-authenticate every 2 hours - terrible UX

**Error Log:**
```
Token state: {
  connectionId: '4bfd492b-4779-4ab1-af69-8a5828d92d62',
  providerId: 'tink',
  hasRefreshToken: false,  // ❌ NO REFRESH TOKEN
  expiresAt: '2025-11-21T21:59:52.580Z',  // 2 hour expiry
  isExpired: true,
  tokenCreatedAt: '2025-11-21T19:59:52.898979+00:00',
  tokenUpdatedAt: '2025-11-21T19:59:52.801+00:00'
}
```

## Root Cause

**Tink's OAuth API has different token types:**

1. **Short-lived tokens (2 hours)** - What we're getting
   - No refresh token provided
   - Requires full re-authentication after expiry

2. **Long-lived tokens (30+ days)** - What we need
   - Requires specific Tink Console configuration
   - Needs "permanent user" setup in Tink app settings

## Current Implementation

### What We're Requesting
```typescript
// lib/tink-client.ts line 171
scope: 'accounts:read,transactions:read'
```

### What Tink Returns
```json
{
  "access_token": "...",
  "expires_in": 7200,  // 2 hours
  "token_type": "Bearer",
  "refresh_token": null  // ❌ NO REFRESH TOKEN
}
```

## Solution Options

### ❌ Option 1: Use Refresh Tokens (NOT AVAILABLE)
**Status:** NOT POSSIBLE
**Reason:** Tink is not providing refresh tokens in the OAuth response

### ❌ Option 2: Request Different Scopes
**Status:** UNLIKELY TO WORK
**Reason:** Tink's token lifetime is configured in the Console, not via scopes

### ✅ Option 3: Configure Tink Console for Permanent Access
**Status:** RECOMMENDED
**Requirements:**
1. Log into Tink Console: https://console.tink.com/
2. Navigate to your app settings
3. Enable "Permanent user access"
4. Configure token lifetime (30+ days)
5. May require contacting Tink support

### ✅ Option 4: Implement Scheduled Re-authentication
**Status:** WORKAROUND (if Option 3 not available)
**Approach:** 
- Schedule background sync 1.5 hours after token creation
- If sync fails due to expiry, flag connection as "needs reconnection"
- Show clear UI prompting user to reconnect

## Recommended Actions

### Immediate (Workaround)
1. ✅ Add clear UX when tokens expire
2. ✅ Implement scheduled sync before expiry (1.5 hour mark)
3. ✅ Add "Reconnect" button on connection detail page
4. ✅ Email notification when reconnection needed

### Long-term (Proper Fix)
1. ⏳ Contact Tink support about permanent user access
2. ⏳ Configure Tink Console for long-lived tokens
3. ⏳ Request refresh token support

## Implementation Plan

### Phase 1: Improve UX (Now)
- [ ] Add clear error message when token expires
- [ ] Show "Last synced X hours ago" on connection card
- [ ] Add prominent "Reconnect" button
- [ ] Send email notification 30min before expiry

### Phase 2: Smart Scheduling (Now)
- [ ] Schedule sync at 1.5 hours after connection
- [ ] If sync succeeds, schedule next at +1.5 hours
- [ ] If sync fails (expired), mark connection as "needs_reconnection"
- [ ] Stop scheduling syncs until user reconnects

### Phase 3: Tink Console Configuration (Contact Tink)
- [ ] Open Tink support ticket
- [ ] Request permanent user access configuration
- [ ] Enable refresh tokens in Console
- [ ] Update scope parameters if needed

## Comparison with Other Providers

| Provider | Token Lifetime | Refresh Token | Our Status |
|----------|---------------|---------------|------------|
| Plaid | 24+ hours | ✅ Yes | ✅ Working |
| Bunq | 90 days | ✅ Yes | ✅ Working |
| Tink | 2 hours | ❌ No | ❌ **BROKEN** |

## User Experience Impact

### Current (Broken)
1. User connects Tink ✅
2. Data syncs for 2 hours ✅
3. Token expires ❌
4. All syncs fail silently ❌
5. User has no idea why data is stale ❌
6. Must reconnect every 2 hours ❌❌❌

### Target (Fixed)
1. User connects Tink once ✅
2. Data syncs continuously ✅
3. Tokens last 30+ days ✅
4. Auto-refresh before expiry ✅
5. User never thinks about it ✅

### Interim (Workaround)
1. User connects Tink ✅
2. Data syncs for 1.5 hours ✅
3. Smart sync before expiry ✅
4. If fails, clear notification ✅
5. Easy reconnect button ✅
6. Reconnect every 2 hours (better UX) ⚠️

## Technical Details

### Token Expiry Check
```typescript
// app/api/banking/[provider]/sync/route.ts:168
if (tokens.expiresAt && provider.isTokenExpired(tokens.expiresAt)) {
  if (!tokens.refreshToken) {
    // ❌ FAILS HERE - no refresh token
    throw new Error('Token expired, no refresh token');
  }
}
```

### Smart Scheduling Logic
```typescript
// Calculate when to sync based on token creation
const tokenCreatedAt = new Date(tokenData.created_at);
const tokenExpiresAt = new Date(tokenData.expires_at);
const tokenLifetime = tokenExpiresAt - tokenCreatedAt; // 2 hours

// Schedule sync at 75% of token lifetime (1.5 hours)
const nextSyncAt = new Date(tokenCreatedAt.getTime() + (tokenLifetime * 0.75));

// Only sync if token still valid
if (Date.now() < tokenExpiresAt) {
  // Safe to sync
} else {
  // Mark as needs reconnection
}
```

## Questions for Tink Support

1. How do we configure our app for "permanent user access"?
2. What is the maximum token lifetime available?
3. Can we get refresh tokens for our integration?
4. Is there a way to request long-lived tokens via OAuth scopes?
5. What's the recommended approach for continuous data access?

## Next Steps

### Today (Immediate)
1. ✅ Document the issue
2. ⏳ Implement smart scheduling
3. ⏳ Add clear reconnection UX
4. ⏳ Deploy workaround

### This Week (Contact Tink)
5. ⏳ Open Tink support ticket
6. ⏳ Request permanent access configuration
7. ⏳ Schedule call with Tink if needed

### After Tink Response
8. ⏳ Configure Console per Tink's guidance
9. ⏳ Test with long-lived tokens
10. ⏳ Remove workaround if proper fix works

---

**Status:** Documented - Ready to implement workaround
**Priority:** HIGH - User experience is broken
**Blocker:** Waiting on Tink Console configuration OR implement workaround



