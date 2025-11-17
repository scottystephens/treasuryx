# Tink Transaction Fields: Currently Used vs. Available

## Summary

**Currently displaying:** 8 fields  
**Available from Tink:** 20+ fields  
**Missing valuable fields:** Booking status, value dates, transaction codes, enhanced merchant data

---

## 🟢 Fields Currently Used

### What We Display in UI

| Field | Tink Source | Our DB Column | UI Location |
|-------|-------------|---------------|-------------|
| **Date** | `dates.booked` | `date` | All transaction tables |
| **Amount** | `amount.value` | `amount` | All transaction tables |
| **Currency** | `amount.currencyCode` | `currency` | All transaction tables |
| **Description** | `descriptions.display` / `descriptions.original` | `description` | Transaction detail |
| **Type** | Derived from amount | `type` | Badge (Credit/Debit) |
| **Category** | `categories.pfm.name` | `category` | Badge in tables |
| **Counterparty** | `merchantName` | `counterparty_name`, `merchant_name` | Transaction detail |
| **Reference** | `reference` | `reference` | Transaction detail |

---

## 🔴 Fields Available But NOT Currently Used

### Tink Transaction Object Structure

```typescript
{
  id: string;                          // ✅ Used as external_transaction_id
  accountId: string;                   // ✅ Used
  amount: {
    value: {
      unscaledValue: string;          // ✅ Used
      scale: number;                  // ✅ Used
    };
    currencyCode: string;             // ✅ Used
  };
  dates: {
    booked: string;                   // ✅ Used as main date
    value: string;                    // ❌ NOT USED - Value date (when money actually moves)
  };
  descriptions: {
    original: string;                 // ✅ Used as fallback
    display: string;                  // ✅ Used as primary description
  };
  
  // ❌ NOT USED - Important fields below
  
  bookingStatus: 'BOOKED' | 'PENDING'; // ❌ Shows if transaction is confirmed or pending
  originalDate: string;                 // ❌ Original transaction date (before adjustments)
  
  types: {
    type: string;                       // ❌ Transaction type code (e.g., 'CARD_PAYMENT', 'TRANSFER')
    code: string;                       // ❌ Bank-specific transaction code
  };
  
  merchantName: string;                 // ✅ Used
  
  categories: {
    pfm: {
      id: string;                       // ❌ Category ID for programmatic use
      name: string;                     // ✅ Used
    };
  };
  
  reference: string;                    // ✅ Used
  notes: string;                        // ❌ Additional notes/details from bank
  
  identifiers: {
    providerTransactionId: string;      // ❌ Bank's internal ID
  };
  
  status: string;                       // ❌ Overall transaction status
}
```

---

## 📊 Detailed Field Analysis

### 1. **Booking Status** ❌ NOT DISPLAYED
**Tink field:** `bookingStatus`  
**Values:** `BOOKED` | `PENDING`  
**Why it matters:** Users need to know if a transaction is confirmed or still pending  
**Current state:** Stored in `metadata.booking_status` but not displayed

**Recommendation:** Add a status badge showing "Confirmed" vs "Pending"

---

### 2. **Value Date** ❌ NOT DISPLAYED
**Tink field:** `dates.value`  
**Why it matters:** When money actually moves (different from booking date)  
**Current state:** Stored in `metadata.value_date` but not displayed  
**Example:** Transaction booked Dec 31, but value date Jan 2 (affects year-end reports)

**Recommendation:** Show both dates:
- Booking Date: When transaction was recorded
- Value Date: When money actually moved

---

### 3. **Transaction Type Code** ❌ NOT DISPLAYED
**Tink field:** `types.type`  
**Values:** `CARD_PAYMENT`, `DIRECT_DEBIT`, `TRANSFER`, `ATM_WITHDRAWAL`, etc.  
**Why it matters:** Helps categorize and filter transactions  
**Current state:** Stored in `metadata.transaction_type` but not displayed

**Recommendation:** Display as a badge or icon for quick identification

---

### 4. **Transaction Code** ❌ NOT DISPLAYED
**Tink field:** `types.code`  
**Why it matters:** Bank-specific codes for reconciliation  
**Current state:** Stored in `metadata.transaction_code` but not displayed

**Recommendation:** Show in transaction detail view for accountants

---

### 5. **Original Date** ❌ NOT DISPLAYED
**Tink field:** `originalDate`  
**Why it matters:** Date before bank adjustments (useful for auditing)  
**Current state:** Stored in `metadata.original_date` but not displayed

---

### 6. **Notes** ❌ NOT DISPLAYED
**Tink field:** `notes`  
**Why it matters:** Additional details from the bank  
**Current state:** Stored in `metadata.notes` but not displayed

---

### 7. **Provider Transaction ID** ❌ NOT DISPLAYED
**Tink field:** `identifiers.providerTransactionId`  
**Why it matters:** Bank's internal ID for support/dispute cases  
**Current state:** Not currently stored

---

### 8. **Category ID** ❌ NOT DISPLAYED
**Tink field:** `categories.pfm.id`  
**Why it matters:** Programmatic category filtering and analytics  
**Current state:** Not currently stored

---

## 🗄️ Database Storage Status

### Fields We Store But Don't Display

```sql
-- transactions.metadata contains:
{
  "tink_transaction_id": "...",        -- ✅ Stored, used internally
  "booking_status": "BOOKED",          -- ✅ Stored, ❌ NOT displayed
  "original_date": "2024-01-15",       -- ✅ Stored, ❌ NOT displayed
  "value_date": "2024-01-16",          -- ✅ Stored, ❌ NOT displayed
  "transaction_type": "CARD_PAYMENT",  -- ✅ Stored, ❌ NOT displayed
  "transaction_code": "POS",           -- ✅ Stored, ❌ NOT displayed
  "notes": "..."                       -- ✅ Stored, ❌ NOT displayed
}
```

### Fields We Don't Even Store

```typescript
- categories.pfm.id                     // Category ID
- identifiers.providerTransactionId     // Bank's internal ID
- status                                // Overall status
```

---

## 🎯 Recommendations

### Priority 1: Display Existing Metadata ⭐⭐⭐

**Already stored, just need to display:**

1. **Booking Status Badge**
   ```typescript
   {metadata.booking_status === 'BOOKED' ? (
     <Badge variant="success">Confirmed</Badge>
   ) : (
     <Badge variant="warning">Pending</Badge>
   )}
   ```

2. **Transaction Type Icon/Badge**
   ```typescript
   <Badge variant="outline">
     {metadata.transaction_type || 'Transfer'}
   </Badge>
   ```

3. **Value Date** (in detail view)
   ```typescript
   Booked: {formatDate(date)}
   Value: {formatDate(metadata.value_date)}
   ```

4. **Notes/Details** (expandable section)
   ```typescript
   {metadata.notes && (
     <div className="text-sm text-muted-foreground">
       {metadata.notes}
     </div>
   )}
   ```

---

### Priority 2: Enhanced Table View ⭐⭐

**Add columns to transaction table:**

| Current | Recommended |
|---------|-------------|
| Date, Description, Category, Reference, Amount | Date, **Status**, Description, **Type**, Category, Reference, Amount |

**Example:**
```
Date       | Status    | Description           | Type         | Category  | Amount
-----------|-----------|----------------------|--------------|-----------|--------
2024-01-15 | Confirmed | Supermarket Purchase | Card Payment | Groceries | €45.20
2024-01-16 | Pending   | Rent Payment         | Transfer     | Housing   | €1200.00
```

---

### Priority 3: Store Additional Fields ⭐

**Enhance the sync process to store:**

```typescript
// In banking-providers/tink-provider.ts - fetchTransactions()
metadata: {
  tink_transaction_id: txn.id,
  booking_status: txn.bookingStatus,
  original_date: txn.originalDate,
  value_date: txn.dates?.value,
  transaction_type: txn.types?.type,
  transaction_code: txn.types?.code,
  notes: txn.notes,
  
  // NEW FIELDS TO ADD:
  category_id: txn.categories?.pfm?.id,           // ✨ Add
  provider_transaction_id: txn.identifiers?.providerTransactionId,  // ✨ Add
  status: txn.status,                             // ✨ Add
}
```

---

### Priority 4: Enhanced Transaction Detail Page ⭐

**Create a comprehensive detail view:**

```typescript
// /accounts/[id]/transactions/[txId]

<TransactionDetailCard>
  <Section title="Overview">
    Amount: €45.20
    Status: Confirmed
    Type: Card Payment
    Category: Groceries
  </Section>
  
  <Section title="Dates">
    Booking Date: Jan 15, 2024
    Value Date: Jan 16, 2024  // NEW
    Original Date: Jan 15, 2024  // NEW
  </Section>
  
  <Section title="Details">
    Merchant: Albert Heijn
    Reference: {reference}
    Transaction Code: POS  // NEW
    Provider ID: {provider_id}  // NEW
  </Section>
  
  <Section title="Notes">
    {notes}  // NEW
  </Section>
</TransactionDetailCard>
```

---

## 💡 Quick Wins

**5-Minute Improvements:**

1. **Add booking status badge** to transaction rows
   ```typescript
   {transaction.metadata?.booking_status === 'PENDING' && (
     <Badge variant="warning" size="sm">Pending</Badge>
   )}
   ```

2. **Show transaction type** as icon
   ```typescript
   {getTransactionTypeIcon(transaction.metadata?.transaction_type)}
   ```

3. **Display notes** in expandable row detail
   ```typescript
   {transaction.metadata?.notes && (
     <p className="text-xs text-muted-foreground mt-1">
       {transaction.metadata.notes}
     </p>
   )}
   ```

---

## 📋 Implementation Checklist

### Phase 1: Display Existing Data (2-3 hours)
- [ ] Add booking status badge to transaction table
- [ ] Add transaction type badge/icon
- [ ] Show value date in detail view
- [ ] Display notes in detail view
- [ ] Add transaction code to detail view

### Phase 2: Enhanced UI (1 day)
- [ ] Create transaction detail page `/accounts/[id]/transactions/[txId]`
- [ ] Add expandable rows in table for extra details
- [ ] Create transaction type icon system
- [ ] Add date comparison (booking vs value)

### Phase 3: Store Additional Fields (1-2 hours)
- [ ] Update Tink provider to capture category ID
- [ ] Update Tink provider to capture provider transaction ID
- [ ] Update Tink provider to capture status
- [ ] Test with new syncs

---

## 🎨 UI Mockup

**Current:**
```
Date       | Description           | Category  | Amount
-----------|-----------------------|-----------|--------
2024-01-15 | Supermarket Purchase  | Groceries | €45.20
```

**Recommended:**
```
Date       | Status    | Description           | Type         | Category  | Amount
-----------|-----------|----------------------|--------------|-----------|----------
2024-01-15 | ✓ Booked | 🛒 Supermarket Purchase | 💳 Card     | Groceries | €45.20
           |           | Albert Heijn          |              | View      |
           |           | Value: 2024-01-16     |              |           |
```

---

## 🔍 Conclusion

**We have the data, we're just not showing it!**

- ✅ **8 fields** currently displayed
- 💤 **5+ fields** stored but hidden (booking status, value date, transaction type, etc.)
- 🆕 **3+ fields** we could easily add (category ID, provider ID, status)

**Total potential:** 16+ fields vs. current 8

**Recommendation:** Start with Phase 1 (displaying existing metadata) - it's all already there in the database!

