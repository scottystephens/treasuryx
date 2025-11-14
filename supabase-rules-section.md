## Working with Supabase Database

### Project Information
- **Project ID:** `vnuithaqtpgbwmdvtxik`
- **Database URL:** `https://vnuithaqtpgbwmdvtxik.supabase.co`
- **Dashboard:** `https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik`
- **SQL Editor:** `https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/sql/new`

### Environment Variables
Required in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL="https://vnuithaqtpgbwmdvtxik.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.vnuithaqtpgbwmdvtxik.supabase.co:5432/postgres"
```

---

### 🔴 CRITICAL: How to Run SQL Migrations

**The ONLY reliable way to run SQL migrations on production Supabase is through the web dashboard.**

#### Method 1: Supabase SQL Editor (Recommended)
1. Go to: [Supabase SQL Editor](https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/sql/new)
2. Open the migration file from `scripts/migrations/`
3. Copy the entire SQL content
4. Paste into the SQL Editor
5. Click **"Run"** (or press `Cmd/Ctrl + Enter`)
6. Verify success message

**Example:**
```bash
# To run migration 06:
# 1. Open: scripts/migrations/06-add-bunq-oauth-support.sql
# 2. Copy all contents
# 3. Paste in SQL Editor: https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/sql/new
# 4. Click Run
```

#### Method 2: TypeScript Scripts (For Data Operations)
For data manipulation (NOT schema changes), use TypeScript scripts:

```bash
# Run data generation scripts
npx tsx scripts/data-generation/create-test-user.ts
npx tsx scripts/data-generation/setup-test-user-org.ts
npx tsx scripts/data-generation/create-test-accounts-v2.ts

# Run utility scripts
npx tsx scripts/utilities/backfill-exchange-rates.ts
npx tsx scripts/utilities/verify-test-user.ts
```

**These scripts use the Supabase client library** (`lib/supabase.ts`) with the service role key.

#### ⚠️ Method 3: CLI (Currently Not Working)
The Supabase CLI commands for remote execution are currently not functional in this environment due to connection issues. **DO NOT USE:**

```bash
# ❌ These do NOT work:
# supabase db execute --file migration.sql
# supabase db push
# psql $DATABASE_URL < migration.sql
```

---

### Running Database Queries from Code

#### Option A: Using Supabase Client (Recommended)
```typescript
import { supabase } from '@/lib/supabase'

// For SELECT queries
const { data, error } = await supabase
  .from('connections')
  .select('*')
  .eq('tenant_id', tenantId)

// For INSERT queries
const { data, error } = await supabase
  .from('connections')
  .insert({ ... })
  .select()
  .single()

// For schema changes - USE SQL EDITOR INSTEAD
// RPC functions like exec_sql() don't exist by default
```

#### Option B: Creating a Helper Function
If you need to run raw SQL programmatically (rare), create:

```sql
-- Run this in SQL Editor first to create the function:
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  EXECUTE sql;
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

Then use it:
```typescript
const { data, error } = await supabase
  .rpc('exec_sql', { sql: 'ALTER TABLE connections ADD COLUMN IF NOT EXISTS oauth_state TEXT' })
```

---

### Common Database Tasks

#### 1. Adding a New Column
**Always use SQL Editor for schema changes:**

```sql
-- Example: Add columns to existing table
ALTER TABLE connections 
ADD COLUMN IF NOT EXISTS oauth_state TEXT,
ADD COLUMN IF NOT EXISTS provider TEXT,
ADD COLUMN IF NOT EXISTS external_connection_id TEXT;
```

#### 2. Checking Table Schema
```typescript
// In a TypeScript script
import { supabase } from '@/lib/supabase'

const { data, error } = await supabase
  .from('connections')
  .select('*')
  .limit(0)

console.log('Columns:', data ? Object.keys(data[0] || {}) : 'N/A')
```

#### 3. Checking RLS Policies
**Run in SQL Editor:**
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

#### 4. Checking if RLS is Enabled
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

#### 5. Viewing Table Structure
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'connections'
ORDER BY ordinal_position;
```

---

### Migration Workflow

#### Creating a New Migration
1. **Create SQL file:** `scripts/migrations/##-descriptive-name.sql`
   - Use sequential numbering (e.g., `08-add-new-feature.sql`)
   - Include `IF NOT EXISTS` / `IF EXISTS` checks
   - Add comments explaining purpose

2. **Test locally first** (if possible)
   - Use a test Supabase project or local instance

3. **Run on production:**
   - Open [Supabase SQL Editor](https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/sql/new)
   - Copy/paste migration SQL
   - Execute and verify

4. **Document in README:**
   - Add to `scripts/README.md` with description
   - Update `scripts/migrations/` list

#### Migration Best Practices
```sql
-- ✅ Good: Safe, idempotent migrations
CREATE TABLE IF NOT EXISTS new_table (...);
ALTER TABLE existing_table ADD COLUMN IF NOT EXISTS new_column TEXT;
CREATE INDEX IF NOT EXISTS idx_name ON table(column);

-- ❌ Bad: Will fail if already exists
CREATE TABLE new_table (...);
ALTER TABLE existing_table ADD COLUMN new_column TEXT;
CREATE INDEX idx_name ON table(column);

-- ✅ Good: Use DO blocks for complex logic
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'connections' AND column_name = 'oauth_state'
  ) THEN
    ALTER TABLE connections ADD COLUMN oauth_state TEXT;
    RAISE NOTICE 'Added oauth_state column';
  ELSE
    RAISE NOTICE 'oauth_state column already exists';
  END IF;
END $$;
```

---

### Troubleshooting Database Issues

#### Error: "Could not find column X"
**Cause:** Column doesn't exist in the table
**Fix:** Run ALTER TABLE in SQL Editor to add it

#### Error: "Row-level security policy violation"
**Cause:** RLS is enabled but no policy grants access
**Fix:** Check and add appropriate RLS policies

#### Error: "Could not find function exec_sql"
**Cause:** The RPC function doesn't exist (it's not built-in)
**Fix:** Use SQL Editor for schema changes, or create the function first

#### Error: "Tenant or user not found"
**Cause:** Incorrect database URL or credentials
**Fix:** Verify environment variables, use web dashboard instead

---

### Quick Reference

| Task | Method | Tool |
|------|--------|------|
| Schema changes (ALTER TABLE, CREATE TABLE) | SQL Editor | [Open Editor](https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/sql/new) |
| Data queries (SELECT, INSERT, UPDATE) | TypeScript | `npx tsx scripts/...` |
| Check schema | SQL Editor | `\d table_name` or `information_schema.columns` |
| View data | Table Editor | [Open Tables](https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/editor) |
| RLS policies | SQL Editor | `SELECT * FROM pg_policies` |
| Test data generation | TypeScript | `npx tsx scripts/data-generation/...` |

---

### Example: Complete Migration Process

```bash
# 1. Create migration file
cat > scripts/migrations/08-add-oauth-columns.sql << 'EOF'
-- Add OAuth support to connections table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'connections' AND column_name = 'oauth_state'
  ) THEN
    ALTER TABLE connections ADD COLUMN oauth_state TEXT;
  END IF;
END $$;
EOF

# 2. Open SQL Editor in browser
open "https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/sql/new"

# 3. Copy migration content
cat scripts/migrations/08-add-oauth-columns.sql | pbcopy

# 4. Paste in SQL Editor and click "Run"

# 5. Verify column was added
# Run in SQL Editor:
# SELECT column_name FROM information_schema.columns 
# WHERE table_name = 'connections';
```

