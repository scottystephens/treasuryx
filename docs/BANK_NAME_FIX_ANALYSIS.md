# 🏦 Bank Name Issue - Analysis & Solution

**Date:** November 23, 2025  
**Issue:** Accounts table showing "Plaid" or "Tink" as Bank Name instead of actual institution

---

## 🔍 Problem Identified

### Current Behavior
When syncing accounts from Plaid or Tink, the `bank_name` field is being set to:
- **"Plaid"** for Plaid accounts
- **"Tink"** for Tink accounts

### Root Cause
**File:** `lib/services/account-service.ts` - Line 238

```typescript
bank_name: providerId.charAt(0).toUpperCase() + providerId.slice(1), // Capitalize provider name
```

This line is hardcoding the provider name (e.g., "plaid" → "Plaid") instead of extracting the actual bank/institution name.

---

## 📊 Database Storage

### What's Currently in DB
```
Account Name          | Bank Name | Provider | What Should Show
Plaid Checking        | Plaid     | plaid    | Chase / Wells Fargo / etc.
Plaid Savings         | Plaid     | plaid    | Chase / Wells Fargo / etc.
Tink Lopende rekening | Tink      | tink     | ING / Rabobank / etc.
```

### Where the Real Data Is Stored

#### For Plaid:
1. **`plaid_accounts.item_id`** - Contains the Plaid Item ID
2. **Plaid Item API** - `item.institution_id` contains the institution ID
3. **Plaid Institutions API** - Can fetch actual bank name using `institution_id`

**Example:**
```typescript
const itemResponse = await plaidClient.itemGet({ access_token });
const institutionId = itemResponse.data.item.institution_id;

const instResponse = await plaidClient.institutionsGetById({
  institution_id: institutionId,
  country_codes: ['US']
});

const bankName = instResponse.data.institution.name; // "Chase", "Wells Fargo", etc.
```

#### For Tink:
1. **`tink_accounts.financial_institution_id`** - Contains the institution ID
2. **Tink Providers API** - Can fetch actual provider/bank name

---

## 💡 Solution Options

### Option 1: Fetch Institution During Account Creation (Recommended)
**Pros:**
- Bank name stored in database immediately
- No need for migrations (just update new syncs)
- Fastest for UI (no extra lookups)

**Cons:**
- Extra API call during sync
- Rate limit considerations

**Implementation:**
1. Update `account-service.ts` → `createOrUpdateAccount()`
2. For Plaid: Call `itemGet()` → `institutionsGetById()`
3. For Tink: Use `financial_institution_id` to fetch provider name
4. Store actual bank name in `bank_name` field

### Option 2: Backfill Existing + Fix New
1. Create migration script to fix existing accounts
2. Update account creation logic for new accounts

### Option 3: Store in metadata, compute at display time
**Pros:**
- No changes to existing data
- Flexible

**Cons:**
- Extra computation on every page load
- Inconsistent with manual accounts

---

## 🎯 Recommended Implementation

### 1. Update Provider Interfaces
Add `institutionName` to `ProviderAccount` interface:

```typescript
// lib/banking-providers/base-provider.ts
export interface ProviderAccount {
  // ... existing fields
  institutionName?: string; // NEW: Actual bank/institution name
  institutionId?: string;   // NEW: Institution identifier
}
```

### 2. Update Plaid Provider
```typescript
// lib/banking-providers/plaid-provider.ts
async fetchAccounts(credentials: ConnectionCredentials): Promise<ProviderAccount[]> {
  const response = await plaidClient.accountsGet({
    access_token: credentials.tokens.accessToken,
  });

  // Fetch institution name
  const itemResponse = await plaidClient.itemGet({
    access_token: credentials.tokens.accessToken,
  });
  
  let institutionName = 'Plaid'; // Fallback
  if (itemResponse.data.item.institution_id) {
    try {
      const instResponse = await plaidClient.institutionsGetById({
        institution_id: itemResponse.data.item.institution_id,
        country_codes: ['US', 'CA', 'GB', 'IE'] as any,
      });
      institutionName = instResponse.data.institution.name;
    } catch (err) {
      console.warn('Could not fetch institution name:', err);
    }
  }

  return response.data.accounts.map((account) => ({
    // ... existing mapping
    institutionName, // NEW
    institutionId: itemResponse.data.item.institution_id, // NEW
    metadata: {
      subtype: account.subtype,
      officialName: account.official_name,
      institutionId: itemResponse.data.item.institution_id, // Also in metadata
    }
  }));
}
```

### 3. Update Tink Provider
```typescript
// lib/banking-providers/tink-provider.ts
async fetchAccounts(credentials: ConnectionCredentials): Promise<ProviderAccount[]> {
  const accounts = await TinkClient.getAccounts(credentials.tokens.accessToken);

  // Fetch provider/institution names if available
  // (Tink might provide this in account.financialInstitutionId)
  
  return accounts.map((account) => ({
    // ... existing mapping
    institutionName: account.financialInstitutionId || 'Tink', // Use institution ID or fallback
    institutionId: account.financialInstitutionId,
    metadata: {
      // ... existing
      financial_institution_id: account.financialInstitutionId,
    }
  }));
}
```

### 4. Update Account Service
```typescript
// lib/services/account-service.ts - Line ~238
bank_name: providerAccount.institutionName || 
           (providerId.charAt(0).toUpperCase() + providerId.slice(1)), // Fallback
```

---

## 🔄 Backfill Script (Optional)

For existing accounts, create a migration script:

```typescript
// scripts/utilities/backfill-bank-names.ts
async function backfillPlaidBankNames() {
  const accounts = await supabase
    .from('accounts')
    .select('*, plaid_accounts(*), provider_tokens(*)')
    .eq('provider_id', 'plaid');

  for (const account of accounts) {
    const token = account.provider_tokens.access_token;
    const itemResponse = await plaidClient.itemGet({ access_token: token });
    const instId = itemResponse.data.item.institution_id;
    
    const instResponse = await plaidClient.institutionsGetById({
      institution_id: instId,
      country_codes: ['US'],
    });

    await supabase
      .from('accounts')
      .update({ bank_name: instResponse.data.institution.name })
      .eq('account_id', account.account_id);
  }
}
```

---

## 🚀 Action Plan

1. ✅ Update `ProviderAccount` interface
2. ✅ Update Plaid Provider to fetch institution name
3. ✅ Update Tink Provider (if API supports it)
4. ✅ Update Account Service to use `institutionName`
5. ⚠️  Test with sandbox accounts
6. ⚠️  (Optional) Create backfill script for existing data
7. ✅ Deploy

---

## 📝 Testing Checklist

- [ ] New Plaid connection shows actual bank name (e.g., "Chase")
- [ ] New Tink connection shows actual bank name (e.g., "ING")
- [ ] Manual accounts still work correctly
- [ ] Error handling if institution fetch fails (fallback to provider name)
- [ ] Check rate limits (caching institution names?)

---

## 🎯 Expected Result

**Before:**
```
Account          | Bank Name | Sync
Plaid Checking   | Plaid     | [Plaid]  ❌
Tink Savings     | Tink      | [Tink]   ❌
```

**After:**
```
Account          | Bank Name      | Sync
Plaid Checking   | Chase Bank     | [Plaid]  ✅
Tink Savings     | ING Bank       | [Tink]   ✅
Manual Account   | Wells Fargo    | Manual   ✅
```

---

**Status:** 📋 Solution identified, ready to implement

