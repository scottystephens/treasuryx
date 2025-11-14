# Bunq Production Setup - Quick Start

## 🚨 Current Issue

You're getting "Unauthorized" because Bunq OAuth credentials are not configured in production.

## ✅ Solution: Set Up Bunq Credentials

### Step 1: Create Bunq Developer Account (5 minutes)

1. Go to **https://developer.bunq.com**
2. Click "Get Started" or "Sign Up"
3. Create an account with your email
4. Verify your email address
5. Log into the Developer Portal

### Step 2: Create OAuth Client (5 minutes)

1. In the Bunq Developer Portal, click **"Create New App"**
2. Fill in the details:
   - **App Name:** Stratifi
   - **Description:** Financial management platform
   - **Redirect URI:** `https://stratifi.vercel.app/api/banking/bunq/callback`
   - **Environment:** Start with **Sandbox** (for testing)

3. Click **"Create"**

4. Copy and save these credentials:
   - ✅ **Client ID** (looks like: `1234567890abc...`)
   - ✅ **Client Secret** (looks like: `xyz789def456...`)

### Step 3: Add Environment Variables to Vercel (3 minutes)

#### Option A: Using Vercel CLI (Recommended)

```bash
# Add Bunq Client ID
npx vercel env add BUNQ_CLIENT_ID

# When prompted:
# - What's the value? [paste your Client ID]
# - Add to which environments? Select all (Production, Preview, Development)

# Add Bunq Client Secret
npx vercel env add BUNQ_CLIENT_SECRET

# When prompted:
# - What's the value? [paste your Client Secret]
# - Add to which environments? Select all (Production, Preview, Development)

# Add Redirect URI
npx vercel env add BUNQ_REDIRECT_URI

# When prompted:
# - What's the value? https://stratifi.vercel.app/api/banking/bunq/callback
# - Add to which environments? Production and Preview

# Add Environment (sandbox for testing)
npx vercel env add BUNQ_ENVIRONMENT

# When prompted:
# - What's the value? sandbox
# - Add to which environments? Select all
```

#### Option B: Using Vercel Dashboard

1. Go to **https://vercel.com/scottystephens-projects/stratifi/settings/environment-variables**
2. Click **"Add New"**
3. Add these variables:

| Name | Value | Environments |
|------|-------|--------------|
| `BUNQ_CLIENT_ID` | Your Client ID from Bunq | Production, Preview, Development |
| `BUNQ_CLIENT_SECRET` | Your Client Secret from Bunq | Production, Preview, Development |
| `BUNQ_REDIRECT_URI` | `https://stratifi.vercel.app/api/banking/bunq/callback` | Production, Preview |
| `BUNQ_ENVIRONMENT` | `sandbox` | All (change to `production` later) |

### Step 4: Redeploy (1 minute)

After adding environment variables, trigger a new deployment:

```bash
# Force redeploy to pick up new env vars
npx vercel --prod --force
```

Or just push a small change:
```bash
git commit --allow-empty -m "Trigger redeploy with Bunq env vars"
git push origin main
```

### Step 5: Test (2 minutes)

1. Go to **https://stratifi.vercel.app/connections/new/generic**
2. Click on the **Bunq** card
3. Enter a connection name
4. Click **"Connect with Bunq"**
5. Should redirect to Bunq's OAuth page (no more "Unauthorized")
6. Use Bunq sandbox credentials to test

---

## 🧪 Testing with Bunq Sandbox

### Create Sandbox User

1. Go to **Bunq Developer Portal**
2. Navigate to **"Sandbox Users"**
3. Click **"Create Sandbox User"**
4. Use these credentials for testing

### Test OAuth Flow

1. Connect to Bunq (as above)
2. Use sandbox credentials to log in
3. Authorize the app
4. Should redirect back to Stratifi
5. Connection should show as "active"

### Test Sync

1. Go to **Connections** page
2. Click the **sync button** on your Bunq connection
3. Should sync accounts and transactions
4. Check **Accounts** and **Transactions** pages

---

## 🔄 Switch to Production (When Ready)

After testing in sandbox:

1. Update `BUNQ_ENVIRONMENT` to `production`
2. Update `BUNQ_REDIRECT_URI` if your domain changed
3. Test with a real Bunq account
4. Monitor for any issues

---

## 🎯 Quick Command Reference

```bash
# Add all Bunq env vars at once (interactive)
npx vercel env add BUNQ_CLIENT_ID
npx vercel env add BUNQ_CLIENT_SECRET
npx vercel env add BUNQ_REDIRECT_URI
npx vercel env add BUNQ_ENVIRONMENT

# Redeploy with new env vars
npx vercel --prod --force

# Check env vars
npx vercel env ls

# Pull env vars to local .env
npx vercel env pull .env.local
```

---

## ❓ Common Issues

### "Unauthorized" Error
**Cause:** Missing BUNQ_CLIENT_ID or BUNQ_CLIENT_SECRET
**Fix:** Add environment variables (see Step 3)

### "Invalid OAuth state"
**Cause:** Redirect URI mismatch
**Fix:** Ensure BUNQ_REDIRECT_URI matches what you set in Bunq Developer Portal

### "Bunq configuration incomplete"
**Cause:** Missing environment variables
**Fix:** Verify all 4 Bunq env vars are set

---

## 📞 Need Help?

- **Bunq Developer Portal:** https://developer.bunq.com
- **Bunq API Docs:** https://doc.bunq.com
- **OAuth Guide:** https://doc.bunq.com/basics/authentication/oauth

---

**Expected Time:** ~15 minutes total to get Bunq working in production

