# Tink Credentials - Saved

## Production Credentials (Vercel)

✅ **Configured in Vercel Production Environment**

- **Client ID:** `caceafe5840c485f98f3c33d92a236ac`
- **Client Secret:** `1f98b5876bb04c11adeeff36da43eb78`
- **Redirect URI:** `https://stratifi-pi.vercel.app/api/banking/tink/callback`

## Local Development

Add to `.env.local` (DO NOT COMMIT):

```bash
TINK_CLIENT_ID=caceafe5840c485f98f3c33d92a236ac
TINK_CLIENT_SECRET=1f98b5876bb04c11adeeff36da43eb78
TINK_REDIRECT_URI=http://localhost:3000/api/banking/tink/callback
```

## Tink Console

- **Console URL:** https://console.tink.com
- **Documentation:** https://docs.tink.com

### Redirect URI Configuration

**IMPORTANT:** The redirect URI in Tink Console must match exactly:

```
https://stratifi-pi.vercel.app/api/banking/tink/callback
```

**Common mistakes to avoid:**
- ❌ `https://stratifi-pi.vercel.app/connections` (wrong path)
- ❌ `https://stratifi-pi.vercel.app/api/banking/tink/callback/` (trailing slash)
- ❌ `http://stratifi-pi.vercel.app/api/banking/tink/callback` (http instead of https)
- ✅ `https://stratifi-pi.vercel.app/api/banking/tink/callback` (correct)

## Next Steps

1. ✅ Credentials saved
2. ✅ Environment variables set in Vercel
3. ⏳ Deploy code (in progress)
4. ⏳ Test OAuth flow
5. ⏳ Connect test bank account

---

**Note:** These credentials are stored securely in Vercel. Never commit them to git.

