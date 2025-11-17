# Accounts Provider Indicator Implementation Plan

## Overview

When a user creates a Tink (or other banking provider) integration and accounts are synced, those accounts should appear on `/accounts` with clear visual indicators showing:
1. **Which provider** the account comes from (Tink, Bunq, etc.)
2. **Which connection** manages the account
3. **Visual distinction** between synced accounts vs manually created accounts

---

## Current State Analysis

### Database Schema ✅
- `accounts` table has:
  - `provider_id` (TEXT) - e.g., "tink", "bunq"
  - `connection_id` (UUID) - Foreign key to `connections.id`
  - `iban`, `bic`, `account_holder_name` - Additional metadata
- `connections` table has:
  - `provider` (VARCHAR) - Provider identifier
  - `name` (VARCHAR) - Connection name (e.g., "My Tink Account")
  - `status` - Connection status

### Current API ❌
- `/api/accounts` endpoint (`app/api/accounts/route.ts`):
  - Fetches accounts but **doesn't join** with `connections` table
  - Returns accounts without provider/connection metadata
  - Uses `getAccountsByTenant()` which only selects from `accounts` table

### Current UI ❌
- `/accounts` page (`app/accounts/page.tsx`):
  - Displays accounts but **doesn't show** provider/connection info
  - No visual distinction between synced vs manual accounts
  - No badges or indicators for account source

---

## Implementation Plan

### Phase 1: Database Query Enhancement

#### 1.1 Update API Endpoint to Join Connections
**File:** `app/api/accounts/route.ts`

**Changes:**
- Modify `GET` handler to join `accounts` with `connections` table
- Return enriched account data with connection metadata
- Include provider name, connection name, and connection status

**Query Structure:**
```sql
SELECT 
  accounts.*,
  connections.provider as connection_provider,
  connections.name as connection_name,
  connections.status as connection_status
FROM accounts
LEFT JOIN connections ON accounts.connection_id = connections.id
WHERE accounts.tenant_id = $tenantId
ORDER BY accounts.account_name
```

**TypeScript Interface:**
```typescript
interface AccountWithConnection extends Account {
  connection_provider?: string;
  connection_name?: string;
  connection_status?: string;
}
```

#### 1.2 Update `getAccountsByTenant()` Function
**File:** `lib/supabase.ts`

**Changes:**
- Add optional parameter to include connection data
- Use Supabase `.select()` with join syntax
- Return accounts with connection metadata

**Implementation:**
```typescript
export async function getAccountsByTenant(
  tenantId: string,
  includeConnection: boolean = true
): Promise<Account[]> {
  const query = supabase
    .from('accounts')
    .select(includeConnection 
      ? '*, connections:connection_id(provider, name, status)'
      : '*'
    )
    .eq('tenant_id', tenantId)
    .order('account_name');
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
```

---

### Phase 2: UI Enhancements

#### 2.1 Add Provider Badge Component
**File:** `components/ui/provider-badge.tsx` (NEW)

**Purpose:** Reusable badge component to display provider information

**Features:**
- Provider logo/icon (if available)
- Provider name badge
- Color coding by provider (Tink = blue, Bunq = green, etc.)
- Link to connection detail page

**Design:**
```typescript
interface ProviderBadgeProps {
  provider: string; // "tink", "bunq", etc.
  connectionName?: string;
  connectionId?: string;
  showLink?: boolean;
}
```

#### 2.2 Add Account Source Indicator
**File:** `components/ui/account-source-indicator.tsx` (NEW)

**Purpose:** Visual indicator showing if account is synced or manual

**Features:**
- Badge showing "Synced" vs "Manual"
- Icon (Link icon for synced, Edit icon for manual)
- Color coding (Green for synced, Gray for manual)

#### 2.3 Update Accounts Page UI
**File:** `app/accounts/page.tsx`

**Changes:**
1. **Account Card Enhancements:**
   - Add provider badge at top of card
   - Show connection name below account name
   - Add "Synced" vs "Manual" indicator
   - Add link to connection detail page (if synced)

2. **Account Card Layout:**
   ```
   ┌─────────────────────────────────┐
   │ [Provider Badge] [Synced Badge] │
   │ Account Name                    │
   │ Via: Connection Name            │
   │ ••••1234                        │
   │                                 │
   │ Type: Checking                  │
   │ Status: Active                  │
   │ Bank: Chase                     │
   │                                 │
   │ Balance: $10,000.00             │
   │                                 │
   │ [Edit] [Transactions]           │
   └─────────────────────────────────┘
   ```

3. **Filtering Options:**
   - Add filter dropdown: "All Accounts", "Synced", "Manual", "By Provider"
   - Add provider filter: "Tink", "Bunq", "Manual"

4. **Empty State Enhancement:**
   - Show link to create connection if no synced accounts
   - Suggest connecting a provider

#### 2.4 Update Account TypeScript Interface
**File:** `lib/supabase.ts`

**Changes:**
- Extend `Account` interface to include connection metadata
- Add optional fields for UI display

```typescript
export interface Account {
  // ... existing fields ...
  
  // Connection metadata (populated via join)
  connection_provider?: string;
  connection_name?: string;
  connection_status?: string;
  
  // Computed fields for UI
  is_synced?: boolean; // true if connection_id is not null
  sync_status?: 'synced' | 'manual' | 'disconnected';
}
```

---

### Phase 3: Visual Design Specifications

#### 3.1 Provider Badge Colors
- **Tink:** Blue (`bg-blue-100 text-blue-800`)
- **Bunq:** Green (`bg-green-100 text-green-800`)
- **Manual:** Gray (`bg-gray-100 text-gray-800`)
- **Other:** Purple (`bg-purple-100 text-purple-800`)

#### 3.2 Icons
- **Synced Account:** `Link` icon from Lucide React
- **Manual Account:** `Edit` icon from Lucide React
- **Provider Icons:** Use provider logos from `public/logos/` if available

#### 3.3 Badge Styles
- **Provider Badge:** Small, rounded, colored background
- **Source Badge:** Small, outlined, with icon
- **Connection Link:** Subtle text link, hover underline

---

### Phase 4: Additional Features (Optional)

#### 4.1 Account Detail Page Enhancement
**File:** `app/accounts/[id]/page.tsx` (if exists)

**Changes:**
- Show full connection information
- Display sync history
- Show last sync timestamp
- Link to connection settings

#### 4.2 Bulk Actions
- Filter accounts by provider
- Export accounts by provider
- Disconnect accounts from connection

#### 4.3 Account Status Indicators
- Show if account sync is enabled/disabled
- Display last sync time
- Show sync errors if any

---

## Database Considerations

### No Schema Changes Required ✅
- All necessary fields already exist from Migration 11
- `accounts.provider_id` and `accounts.connection_id` are populated
- `connections.provider` and `connections.name` are available

### Query Performance
- Add index on `accounts.connection_id` if not exists (already done in migration)
- Consider materialized view if query becomes slow with many accounts
- Use Supabase's built-in join optimization

---

## Implementation Steps

### Step 1: Backend API Updates
1. ✅ Update `getAccountsByTenant()` in `lib/supabase.ts`
2. ✅ Update `/api/accounts` GET handler
3. ✅ Test API endpoint returns connection data
4. ✅ Verify TypeScript types are correct

### Step 2: UI Components
1. ✅ Create `ProviderBadge` component
2. ✅ Create `AccountSourceIndicator` component
3. ✅ Update `Account` interface in `lib/supabase.ts`

### Step 3: Accounts Page Updates
1. ✅ Update account card layout
2. ✅ Add provider badges
3. ✅ Add source indicators
4. ✅ Add filtering UI
5. ✅ Update empty state

### Step 4: Testing
1. ✅ Test with Tink synced accounts
2. ✅ Test with manual accounts
3. ✅ Test filtering functionality
4. ✅ Test connection links
5. ✅ Verify responsive design

### Step 5: Documentation
1. ✅ Update component documentation
2. ✅ Add usage examples
3. ✅ Document API changes

---

## Testing Checklist

### Functional Tests
- [ ] Accounts from Tink integration appear with "Tink" badge
- [ ] Connection name displays correctly
- [ ] Manual accounts show "Manual" indicator
- [ ] Provider badge links to connection detail page
- [ ] Filtering by provider works
- [ ] Filtering by source (synced/manual) works
- [ ] Empty state shows appropriate message

### Visual Tests
- [ ] Provider badges are color-coded correctly
- [ ] Badges are readable and accessible
- [ ] Layout works on mobile devices
- [ ] Icons are clear and recognizable
- [ ] Hover states work correctly

### Edge Cases
- [ ] Accounts with null `connection_id` show as manual
- [ ] Accounts with deleted connections handle gracefully
- [ ] Multiple accounts from same connection display correctly
- [ ] Accounts with no provider show appropriately

---

## Success Criteria

✅ **User can immediately see:**
1. Which accounts came from Tink (or other providers)
2. Which connection manages each account
3. Visual distinction between synced and manual accounts
4. Easy navigation to connection details

✅ **Technical Requirements:**
1. API returns connection metadata
2. UI components are reusable
3. TypeScript types are correct
4. No performance degradation
5. Responsive design maintained

---

## Future Enhancements

1. **Provider Logos:** Add actual provider logos to badges
2. **Sync Status:** Show real-time sync status per account
3. **Last Sync Time:** Display when account was last synced
4. **Sync Errors:** Show sync errors on account card
5. **Quick Actions:** Add "Sync Now" button on account card
6. **Account Grouping:** Group accounts by connection/provider
7. **Analytics:** Track account creation sources

---

## Files to Modify/Create

### Modify
- `app/api/accounts/route.ts` - Add connection join
- `lib/supabase.ts` - Update `getAccountsByTenant()` and `Account` interface
- `app/accounts/page.tsx` - Update UI with badges and indicators

### Create
- `components/ui/provider-badge.tsx` - Provider badge component
- `components/ui/account-source-indicator.tsx` - Source indicator component

### Optional
- `app/accounts/[id]/page.tsx` - Enhance account detail page (if exists)

---

## Estimated Implementation Time

- **Phase 1 (Backend):** 1-2 hours
- **Phase 2 (UI Components):** 2-3 hours
- **Phase 3 (Accounts Page):** 2-3 hours
- **Phase 4 (Testing):** 1-2 hours
- **Total:** 6-10 hours

---

## Notes

- All database fields already exist (Migration 11)
- No migrations required
- Can be implemented incrementally
- Backward compatible (manual accounts still work)
- Uses existing Supabase join capabilities

---

*Plan Created: November 15, 2025*  
*Status: Ready for Implementation*

