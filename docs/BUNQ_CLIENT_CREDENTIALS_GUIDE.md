# What Credentials Do Clients Need to Send You?

## Short Answer: **NONE!** 🎉

When building with Bunq's OAuth integration, **your clients don't need to send you any credentials at all**. This is the beauty of OAuth.

## How It Works

### Traditional API Key Approach ❌ (NOT USED)
```
❌ DON'T DO THIS:
Client → Generates API Key in Bunq → Sends you the key → You store it
         (Security risk, full access, hard to revoke)
```

### OAuth Approach ✅ (WHAT WE BUILT)
```
✅ THE RIGHT WAY:
Client → Clicks "Connect Bunq" in your app
      → Redirected to Bunq
      → Logs in with THEIR credentials (private)
      → Authorizes your app (read-only)
      → Redirected back to your app
      → You receive OAuth token (automatic)
```

## What You Need (As the Developer)

### From Bunq Developer Portal

You (the developer) need these **once** for your entire application:

1. **Client ID** - Public identifier for your app
2. **Client Secret** - Private key for your app (keep secret!)
3. **Redirect URI** - Where Bunq sends users back

Example:
```bash
# You add these to YOUR environment variables
BUNQ_CLIENT_ID=abc123def456  # From Bunq Developer Portal
BUNQ_CLIENT_SECRET=xyz789ghi012  # From Bunq Developer Portal
BUNQ_REDIRECT_URI=https://yourapp.com/api/connections/bunq/callback
```

## What Your Clients Do

### Step 1: Click Button in Your App
```typescript
// In your app, they just click:
<BunqConnectButton tenantId={tenant.id} />
```

### Step 2: Log Into Bunq
- They're redirected to Bunq's secure login page
- They enter THEIR Bunq username/password
- They never share these credentials with you

### Step 3: Grant Permission
- Bunq shows them what your app wants to access
- Typically: "Read your account information and transactions"
- They click "Authorize"

### Step 4: Done!
- They're redirected back to your app
- Your app automatically receives an access token
- They see "Connection successful!"
- No credentials exchanged!

## What Gets Stored

### In Your Database

You automatically store:

```javascript
{
  access_token: "bunq-oauth-token-abc123...",  // Expires in ~1 hour
  refresh_token: "bunq-refresh-token-xyz...",  // For renewing access
  expires_at: "2025-11-14T12:00:00Z",
  bunq_user_id: "12345",
  tenant_id: "your-client-tenant-id"
}
```

**Important:** Your clients never see these tokens. They're stored server-side.

## Security Benefits

### For Your Clients ✅

✅ **No password sharing** - They never give you their Bunq password  
✅ **Read-only access** - You can't make payments or changes  
✅ **Easy revocation** - They can disconnect in Bunq app anytime  
✅ **Granular control** - They see exactly what you can access  
✅ **Industry standard** - Same as "Sign in with Google"  

### For You ✅

✅ **No credential storage** - Don't handle client passwords  
✅ **Automatic refresh** - Tokens auto-renew  
✅ **Reduced liability** - Can't access more than granted  
✅ **Better UX** - Seamless connection flow  
✅ **PSD2 compliant** - Meets EU banking regulations  

## Client Communication Template

When explaining to your clients, you can say:

---

### Email Template

**Subject: Connect Your Bunq Account - No Credentials Needed**

Hi [Client],

To connect your Bunq account to Stratifi, you don't need to send us any credentials or API keys.

**Here's what you'll do:**

1. Log into Stratifi
2. Go to Connections → New Connection
3. Select "Bunq Banking"
4. Click "Connect with Bunq"
5. You'll be redirected to Bunq's secure website
6. Log in with your Bunq credentials (we never see these)
7. Authorize Stratifi to access your account data (read-only)
8. You'll be redirected back - done!

**Security Notes:**
- We never see your Bunq password
- You can revoke access anytime in your Bunq app
- We only get read-only access to accounts and transactions
- This uses industry-standard OAuth (same as "Sign in with Google")

**Questions?**
- Check our help docs at [link]
- Contact support at [email]

Thanks!
[Your Team]

---

## Troubleshooting for Clients

### "It's asking me to log into Bunq"
✅ **This is normal!** That's the secure OAuth flow. Log in with your Bunq credentials.

### "I don't want to share my password"
✅ **You're not!** You're logging into Bunq's website directly, not giving us your password.

### "What can you access?"
✅ **Read-only access to:**
- Your account names and numbers
- Account balances
- Transaction history

✅ **We CANNOT:**
- Make payments
- Change account settings
- See your Bunq password
- Transfer money

### "How do I disconnect?"
✅ **Two ways:**
1. In Stratifi: Connections → Delete the Bunq connection
2. In Bunq app: Settings → Security → Connected Apps → Revoke Stratifi

## Comparison: API Key vs OAuth

| Aspect | API Key ❌ | OAuth ✅ |
|--------|-----------|----------|
| Client sends credentials? | Yes, they generate and send key | No, they just click authorize |
| Your liability | High - you store sensitive keys | Low - tokens are temporary |
| Access scope | Often full account access | Granular, read-only |
| Revocation | Client must regenerate key | Click to revoke in app |
| Expiration | Never (until revoked) | Auto-expires and refreshes |
| User experience | Technical, confusing | Simple, one-click |
| Security | Risky if leaked | Industry standard |
| Compliance | May not meet PSD2 | PSD2 compliant |

## For Different Client Types

### Technical Clients
*"We use OAuth 2.0 for secure, read-only access to your Bunq data. You'll authorize our app through Bunq's standard OAuth flow. No API keys needed."*

### Non-Technical Clients
*"Just click the button to connect your Bunq account. You'll log into Bunq like normal, then click to allow us to see your transactions. That's it!"*

### Enterprise Clients
*"Our integration uses OAuth 2.0 with PSD2 compliance. We receive read-only access to account information and transaction history. All data transmission is encrypted, tokens are stored securely with RLS policies, and your team maintains full control via Bunq's consent management."*

## What If They Insist on API Keys?

**Response:**

"While Bunq does offer API keys, we've built our integration using OAuth for several important reasons:

1. **Security:** OAuth is more secure than shared API keys
2. **Compliance:** Required for PSD2/Open Banking regulations
3. **Control:** You can revoke access instantly in your Bunq app
4. **Scope:** We only get read-only access, nothing more
5. **Standards:** OAuth is the industry standard (used by Google, Facebook, etc.)

Our OAuth integration actually protects you better than API keys would. You never share any credentials with us, and you maintain complete control over the connection."

## Technical: Behind the Scenes

For the technically curious, here's what happens:

```javascript
// 1. Client clicks connect
initiateOAuth({
  client_id: "your-bunq-client-id",
  redirect_uri: "https://yourapp.com/callback",
  state: "random-security-token"
})

// 2. Bunq redirects back with code
receiveCallback({
  code: "bunq-authorization-code",
  state: "same-security-token"
})

// 3. Your server exchanges code for token
exchangeToken({
  code: "bunq-authorization-code",
  client_id: "your-bunq-client-id",
  client_secret: "your-bunq-client-secret"
})

// 4. You receive and store tokens
storeTokens({
  access_token: "...",
  refresh_token: "...",
  expires_in: 3600
})

// 5. Use token to fetch data
fetchData({
  headers: {
    Authorization: "Bearer access-token"
  }
})
```

**Client never sees any of this!** They just click and authorize.

## Summary

### ✅ What Clients Send You
**NOTHING!** They just click a button and authorize through Bunq's website.

### ✅ What You Need
- Bunq Developer Account
- Client ID (one per application)
- Client Secret (one per application)
- These go in YOUR environment variables

### ✅ What Happens
1. Client clicks "Connect"
2. Client logs into Bunq (secure)
3. Client authorizes your app
4. You automatically receive OAuth token
5. You can now fetch their data (read-only)

### ✅ Security
- No password sharing
- No API key exchange
- Automatic token refresh
- Easy revocation
- Industry standard
- PSD2 compliant

---

**Bottom Line:** OAuth means your clients never need to send you any credentials. They just click, authorize, and you're connected. It's secure, simple, and compliant. 🎉

