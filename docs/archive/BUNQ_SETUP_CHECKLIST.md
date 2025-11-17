# Bunq Integration Setup Checklist

Complete this checklist to enable Bunq banking integration in production.

## Prerequisites

### ✅ Step 1: Bunq Developer Account
- [ ] Created account at https://developer.bunq.com
- [ ] Logged into Bunq Developer Portal
- [ ] Verified email address

### ✅ Step 2: Create OAuth Client
- [ ] Created OAuth Client in Developer Portal
- [ ] Set application name
- [ ] Configured redirect URI: `https://yourdomain.com/api/connections/bunq/callback`
- [ ] Copied Client ID
- [ ] Copied Client Secret
- [ ] Saved credentials securely

## Environment Configuration

### ✅ Step 3: Set Environment Variables

Add to Vercel/Production environment:

```bash
BUNQ_CLIENT_ID=your_client_id_here
BUNQ_CLIENT_SECRET=your_client_secret_here
BUNQ_REDIRECT_URI=https://yourdomain.com/api/connections/bunq/callback
BUNQ_ENVIRONMENT=production
```

For local development (`.env.local`):

```bash
BUNQ_CLIENT_ID=your_sandbox_client_id
BUNQ_CLIENT_SECRET=your_sandbox_client_secret
BUNQ_REDIRECT_URI=http://localhost:3000/api/connections/bunq/callback
BUNQ_ENVIRONMENT=sandbox
```

- [ ] Added to production environment
- [ ] Added to `.env.local` for development
- [ ] Verified variables are loaded (check console)

## Database Setup

### ✅ Step 4: Run Migration

Using Supabase:

```bash
# Option 1: Via Supabase CLI
supabase db push scripts/migrations/06-add-bunq-oauth-support.sql

# Option 2: Via Supabase Dashboard
# Go to SQL Editor → New Query → Paste migration → Run
```

- [ ] Migration executed successfully
- [ ] Verified tables created:
  - [ ] `bunq_oauth_tokens`
  - [ ] `bunq_accounts`
  - [ ] `bunq_transactions_staging`
- [ ] RLS policies enabled
- [ ] Indexes created

### ✅ Step 5: Verify Database Schema

Run this query to verify tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'bunq%';
```

Expected results:
- `bunq_oauth_tokens`
- `bunq_accounts`
- `bunq_transactions_staging`

- [ ] All three tables exist
- [ ] RLS is enabled on all tables
- [ ] Helper functions exist

## Application Deployment

### ✅ Step 6: Deploy Code

- [ ] Code pushed to main branch
- [ ] Vercel/hosting platform deployed latest code
- [ ] No build errors
- [ ] Environment variables loaded in production

### ✅ Step 7: Verify Deployment

Check these URLs (replace with your domain):

- [ ] https://yourdomain.com/connections/new loads
- [ ] Bunq option is visible
- [ ] No console errors

## Testing

### ✅ Step 8: Test OAuth Flow (Sandbox)

1. Set `BUNQ_ENVIRONMENT=sandbox`
2. Create sandbox user in Bunq Developer Portal
3. Test connection:

- [ ] Click "New Connection"
- [ ] Select "Bunq Banking"
- [ ] Click "Connect with Bunq"
- [ ] Redirected to Bunq OAuth page
- [ ] Successfully authorized
- [ ] Redirected back to Stratifi
- [ ] Connection shows as "active"

### ✅ Step 9: Test Account Sync (Sandbox)

- [ ] Click sync button on connection
- [ ] Accounts fetched from Bunq
- [ ] Accounts created in Stratifi
- [ ] No errors in console
- [ ] View accounts page shows new accounts

### ✅ Step 10: Test Transaction Sync (Sandbox)

- [ ] Click sync button again
- [ ] Transactions fetched from Bunq
- [ ] Transactions imported
- [ ] View transactions page shows data
- [ ] No duplicate transactions

## Production Testing

### ✅ Step 11: Switch to Production

- [ ] Set `BUNQ_ENVIRONMENT=production`
- [ ] Update redirect URI to production domain
- [ ] Deploy changes
- [ ] Clear any sandbox data

### ✅ Step 12: Production Test

- [ ] Test with real Bunq account
- [ ] OAuth flow works
- [ ] Account sync works
- [ ] Transaction sync works
- [ ] Data appears correctly

## Monitoring Setup

### ✅ Step 13: Configure Monitoring

- [ ] Set up error logging (Sentry, LogRocket, etc.)
- [ ] Monitor OAuth callback endpoint
- [ ] Monitor sync endpoints
- [ ] Set up alerts for failed syncs

### ✅ Step 14: Create Dashboard

Monitor these metrics:
- [ ] Number of Bunq connections
- [ ] Failed OAuth attempts
- [ ] Failed sync jobs
- [ ] Token refresh failures

## Documentation

### ✅ Step 15: User Documentation

- [ ] Create user guide for connecting Bunq
- [ ] Add troubleshooting section
- [ ] Document sync frequency
- [ ] Explain how to disconnect

### ✅ Step 16: Support Preparation

- [ ] Train support team on Bunq integration
- [ ] Create FAQ document
- [ ] Document common errors and solutions
- [ ] Set up support ticket categories

## Security Review

### ✅ Step 17: Security Checklist

- [ ] Tokens stored securely
- [ ] RLS policies verified
- [ ] OAuth state validation working
- [ ] HTTPS enforced on all endpoints
- [ ] Redirect URI whitelist configured
- [ ] No tokens in logs or frontend

### ✅ Step 18: Compliance

- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] User consent flow reviewed
- [ ] Data retention policy defined
- [ ] GDPR compliance verified

## Go Live

### ✅ Step 19: Soft Launch

- [ ] Enable for beta users only
- [ ] Gather feedback
- [ ] Monitor error rates
- [ ] Fix any issues

### ✅ Step 20: Full Launch

- [ ] Announce feature to all users
- [ ] Monitor for 48 hours
- [ ] Address any issues quickly
- [ ] Celebrate! 🎉

## Post-Launch

### Regular Maintenance

Weekly:
- [ ] Check ingestion_jobs for failures
- [ ] Review error logs
- [ ] Monitor token expiration

Monthly:
- [ ] Review sync performance
- [ ] Check API rate limit usage
- [ ] Clean up old staging data
- [ ] Update documentation as needed

Quarterly:
- [ ] Review Bunq API for changes
- [ ] Update client library if needed
- [ ] Audit security policies
- [ ] Gather user feedback

## Troubleshooting

Common issues and solutions:

### OAuth Errors
**Problem:** "Invalid OAuth state"  
**Solution:** User needs to restart connection process

**Problem:** "Token expired"  
**Solution:** User needs to reconnect account

### Sync Errors
**Problem:** "No accounts found"  
**Solution:** Run account sync before transaction sync

**Problem:** "Rate limit exceeded"  
**Solution:** Wait 5 minutes before retrying

### Configuration Errors
**Problem:** "Bunq configuration incomplete"  
**Solution:** Check all environment variables are set

## Support Contacts

- **Bunq Developer Support:** support@bunq.com
- **Bunq API Documentation:** https://doc.bunq.com
- **Bunq Developer Portal:** https://developer.bunq.com

## Notes

Date completed: _______________
Completed by: _______________
Production URL: _______________
Bunq Client ID: _______________

