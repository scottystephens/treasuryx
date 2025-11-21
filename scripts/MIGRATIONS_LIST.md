# Database Migrations - Complete List

## Overview

This document lists all database migrations in execution order. Each migration builds upon the previous ones.

## Migration Status

✅ = Executed in production
⏳ = Pending execution
🚀 = Latest migration

---

## Core Setup (Required)

### ✅ 01-create-base-tables.sql
**Purpose:** Foundation tables for the application
**Tables:** accounts, entities, transactions, payments, forecasts
**Status:** Base system

### ✅ 02-setup-multi-tenant.sql
**Purpose:** Multi-tenancy architecture
**Tables:** tenants, user_tenants
**Features:** Row-Level Security (RLS) policies, tenant isolation
**Status:** Core security

### ✅ 03-seed-multi-tenant-data.sql
**Purpose:** Initial test data
**Creates:** 3 test organizations with users
**Status:** Development seed data

---

## Feature Enhancements

### ✅ 04-setup-data-ingestion-safe.sql
**Purpose:** Data ingestion infrastructure
**Tables:** connections, ingestion_jobs, raw_ingestion_data, ingestion_audit
**Features:** CSV upload, data mapping, audit trail
**Status:** Core feature

### ✅ 05-enhance-accounts-safe.sql
**Purpose:** Enhanced account fields
**Enhancements:** Custom fields, industry-standard banking fields
**Status:** Account management

### ✅ 06-add-bunq-oauth-support.sql
**Purpose:** Bunq banking provider OAuth
**Tables:** bunq_tokens
**Features:** OAuth 2.0, token storage
**Status:** First banking integration

### ✅ 06-create-statements-table.sql
**Purpose:** Bank statements storage
**Tables:** statements
**Status:** Statement management

### ✅ 07-add-generic-banking-providers.sql
**Purpose:** Multi-provider banking infrastructure
**Tables:** banking_providers, provider_tokens, provider_accounts, provider_transactions
**Features:** Generic provider interface, OAuth, account/transaction sync
**Status:** Multi-provider foundation

### ✅ 07-enhance-transactions-table.sql
**Purpose:** Enhanced transaction fields
**Enhancements:** Additional metadata, categorization
**Status:** Transaction management

### ✅ 08-enhance-connections-for-data-types.sql
**Purpose:** Connection type support
**Enhancements:** CSV, API, Banking provider types
**Status:** Connection management

### ✅ 09-create-exec-sql-function.sql
**Purpose:** Dynamic SQL execution (admin only)
**Functions:** exec_sql()
**Status:** Admin utility

### ✅ 09-fix-statements-foreign-keys.sql
**Purpose:** Fix foreign key constraints on statements
**Status:** Bug fix

### ✅ 10-fix-provider-tokens-rls.sql
**Purpose:** Fix RLS policies on provider_tokens
**Status:** Security fix

### ✅ 11-enhance-accounts-and-connections.sql
**Purpose:** Account and connection enhancements
**Status:** Feature enhancement

### ✅ 11-enhance-accounts-and-connections-fixed.sql
**Purpose:** Fix for migration 11
**Status:** Bug fix

### ✅ 12-make-entity-id-nullable.sql
**Purpose:** Allow nullable entity_id in accounts
**Status:** Schema fix

### ✅ 13-fix-account-id-length.sql
**Purpose:** Fix account_id length constraints
**Status:** Bug fix

### ✅ 14-remove-all-length-restrictions.sql
**Purpose:** Remove VARCHAR length limits (use TEXT)
**Rationale:** Prevent truncation errors, maximum flexibility
**Status:** Schema optimization

### ✅ 15-add-plaid-provider.sql
**Purpose:** Add Plaid to banking providers
**Status:** Provider setup

### ✅ 15-enhance-entities-with-rls.sql
**Purpose:** Add RLS to entities table
**Status:** Security enhancement

### ✅ 21-add-super-admin-support.sql
**Purpose:** Super admin role and permissions
**Tables:** Enhance user_tenants with super_admin flag
**Status:** Admin features

### ✅ 22-add-orchestration-tables.sql
**Purpose:** Sync orchestration and scheduling
**Tables:** sync_schedules, sync_logs, connection_health
**Features:** Automated syncs, health monitoring
**Status:** Automation infrastructure

### ✅ 23-enhance-provider-transactions.sql
**Purpose:** Enhanced provider transaction fields
**Enhancements:** Additional metadata, categorization
**Status:** Provider data

### ✅ 24-create-dimension-tables.sql
**Purpose:** Dimension tables for analytics
**Tables:** time_dimension, account_dimension, etc.
**Status:** Analytics infrastructure

### ✅ 25-fix-connection-health-groupby.sql
**Purpose:** Fix GROUP BY in connection_health view
**Status:** Bug fix

### ✅ 26-backfill-provider-sync-enabled.sql
**Purpose:** Backfill sync_enabled flag for providers
**Status:** Data migration

### ✅ 27-add-provider-sync-status.sql
**Purpose:** Add sync status tracking
**Status:** Monitoring enhancement

### ✅ 28-create-account-statements.sql
**Purpose:** Account statements management
**Status:** Statement features

### ✅ 29-create-plaid-storage.sql
**Purpose:** Dedicated Plaid data storage
**Tables:** plaid_sync_cursors, plaid_transactions, plaid_accounts
**Features:** Cursor-based incremental sync, cost optimization (67-95% reduction)
**Rationale:** Preserve all Plaid data, enable incremental syncs, audit trail
**Documentation:** `docs/PLAID_OPTIMIZATION_COMPLETE.md`
**Status:** Production optimization

### ✅ 30-cascade-delete-connections.sql
**Purpose:** Add CASCADE delete to connection foreign keys
**Status:** Data integrity

### 🚀 31-create-tink-storage.sql ✅ LATEST
**Purpose:** Dedicated Tink data storage (mirrors Plaid architecture)
**Tables:** tink_sync_cursors, tink_transactions, tink_accounts
**Features:** 
- Complete Tink API v2 data storage
- 30+ structured transaction fields + JSONB
- 25+ structured account fields + JSONB
- Pagination tracking with pageToken
- Two-layer architecture (raw → normalized)
- Full RLS policies and indexes
**Rationale:** 
- Preserve all Tink data for audit trail
- Enable smart sync strategies
- Support European banking (IBAN, BIC)
- Consistent with Plaid pattern
**Documentation:** `docs/TINK_STORAGE_IMPLEMENTATION.md`
**Status:** ✅ **EXECUTED November 21, 2025**
**Verification:** See `MIGRATION_31_COMPLETE.md`

### ✅ create-exchange-rates-table.sql
**Purpose:** Exchange rate tracking
**Tables:** exchange_rates
**Status:** Currency features

---

## Migration Execution

### Method 1: PostgreSQL CLI (Recommended)

```bash
# Run a migration
source .env.local && psql "$DATABASE_URL" -f scripts/migrations/31-create-tink-storage.sql

# Verify tables created
source .env.local && psql "$DATABASE_URL" -c "
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('tink_sync_cursors', 'tink_transactions', 'tink_accounts');"
```

### Method 2: Supabase SQL Editor

1. Open: https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/sql/new
2. Copy migration file contents
3. Paste and click "Run"

---

## Provider-Specific Tables

### Bunq
- `bunq_tokens` (Migration 06)

### Plaid (Migration 29)
- `plaid_sync_cursors` - Stores `next_cursor` for incremental sync
- `plaid_transactions` - Raw Plaid transaction data (56 columns + JSONB)
- `plaid_accounts` - Raw Plaid account data (21 columns + JSONB)

### Tink (Migration 31) 🆕
- `tink_sync_cursors` - Stores `pageToken` for pagination
- `tink_transactions` - Raw Tink transaction data (33 columns + JSONB)
- `tink_accounts` - Raw Tink account data (25 columns + JSONB)

### Generic (Migration 07)
- `banking_providers` - Provider registry
- `provider_tokens` - OAuth tokens (all providers)
- `provider_accounts` - Generic account storage
- `provider_transactions` - Generic transaction storage

---

## Architecture Patterns

### Two-Layer Storage (Plaid & Tink)

```
┌─────────────────────────────────────────┐
│         Provider API (Source)           │
│  - Complete data with all fields        │
└─────────────┬───────────────────────────┘
              │
              │ Fetch & Store (Layer 1)
              ↓
┌─────────────────────────────────────────┐
│   Raw Provider Tables                   │
│  - plaid_*/tink_* tables                │
│  - Complete API responses in JSONB      │
│  - Provider-specific fields             │
│  - Audit trail & compliance             │
└─────────────┬───────────────────────────┘
              │
              │ Import & Transform (Layer 2)
              ↓
┌─────────────────────────────────────────┐
│   Normalized Application Tables         │
│  - accounts (multi-provider)            │
│  - transactions (multi-provider)        │
│  - Unified schema & business logic      │
└─────────────────────────────────────────┘
```

**Benefits:**
- Complete data preservation
- Provider-specific fields accessible
- Business logic separated from data collection
- Easy to add new providers
- Audit trail for compliance

---

## Key Metrics

### Tables Created
- **Core:** ~15 tables
- **Multi-tenant:** 2 tables
- **Data Ingestion:** 4 tables
- **Banking Providers:** 10+ tables (generic + provider-specific)
- **Analytics:** 5+ dimension tables
- **Admin:** 3 orchestration tables
- **Total:** 40+ tables

### RLS Policies
- All tenant-scoped tables protected
- ~100+ RLS policies total
- 11 policies for Tink tables alone

### Indexes
- ~200+ indexes for performance
- 21 indexes for Tink tables
- Optimized for common query patterns

---

## Testing Migrations

### Verification Template

```sql
-- Check table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'your_table_name';

-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename = 'your_table_name';

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'your_table_name';

-- Check RLS policies
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'your_table_name';

-- Check columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'your_table_name'
ORDER BY ordinal_position;
```

---

## Rollback Procedures

### Plaid Tables (Migration 29)
```sql
DROP TABLE IF EXISTS plaid_transactions CASCADE;
DROP TABLE IF EXISTS plaid_accounts CASCADE;
DROP TABLE IF EXISTS plaid_sync_cursors CASCADE;
```

### Tink Tables (Migration 31)
```sql
DROP TABLE IF EXISTS tink_transactions CASCADE;
DROP TABLE IF EXISTS tink_accounts CASCADE;
DROP TABLE IF EXISTS tink_sync_cursors CASCADE;
```

**Note:** Rollback will delete data but preserve connections and OAuth tokens.

---

## Next Migrations (Planned)

### 32-add-monzo-storage.sql (Future)
**Purpose:** Monzo banking provider storage
**Pattern:** Same as Plaid/Tink (two-layer architecture)

### 33-add-wise-storage.sql (Future)
**Purpose:** Wise (TransferWise) integration
**Pattern:** Multi-currency support, international transfers

### 34-add-revolut-storage.sql (Future)
**Purpose:** Revolut integration
**Pattern:** Business accounts, crypto support

---

## Documentation

- **Main Docs:** `docs/guides/DATABASE_SETUP.md`
- **Plaid:** `docs/PLAID_OPTIMIZATION_COMPLETE.md`
- **Tink:** `docs/TINK_STORAGE_IMPLEMENTATION.md`
- **Migrations:** This file

## Support

For migration issues:
1. Check migration verification queries
2. Review error messages in psql output
3. Check Supabase logs
4. Consult provider-specific documentation

---

**Last Updated:** November 21, 2025
**Latest Migration:** 31-create-tink-storage.sql ✅
**Total Migrations:** 31 (+ 1 utility migration)

