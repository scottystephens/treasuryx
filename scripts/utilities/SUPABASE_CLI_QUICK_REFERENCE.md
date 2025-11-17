# Supabase CLI Quick Reference

## Setup Status

✅ **Supabase CLI is installed and configured!**

- **CLI Version:** 2.58.5
- **Location:** `~/.local/bin/supabase`
- **Project:** Linked to `vnuithaqtpgbwmdvtxik` (TreasuryX)
- **Authentication:** ✅ Active

## Common Commands for Cursor

### Push Migrations

```bash
# Push local migrations to remote database
# Note: Migrations must be in supabase/migrations/ directory
supabase db push --project-ref vnuithaqtpgbwmdvtxik

# For executing individual SQL files, use the Supabase SQL Editor:
# https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik/sql/new
```

### Generate TypeScript Types

```bash
# Generate types from remote database schema
supabase gen types typescript --project-id vnuithaqtpgbwmdvtxik > lib/database.types.ts
```

### Project Management

```bash
# List all projects
supabase projects list

# Get project details
supabase projects get vnuithaqtpgbwmdvtxik

# List API keys
supabase projects api-keys --project-ref vnuithaqtpgbwmdvtxik
```

### Database Operations

```bash
# Pull remote schema to local (requires Docker)
supabase db pull --project-ref vnuithaqtpgbwmdvtxik

# Push local migrations to remote
supabase db push --project-ref vnuithaqtpgbwmdvtxik

# Dump remote database schema or data
supabase db dump --project-ref vnuithaqtpgbwmdvtxik --schema public > schema.sql
supabase db dump --project-ref vnuithaqtpgbwmdvtxik --data-only > data.sql

# Compare local vs remote schema (requires Docker)
supabase db diff --project-ref vnuithaqtpgbwmdvtxik
```

## Important Notes

1. **PATH Setup:** Make sure `~/.local/bin` is in your PATH:
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```

2. **Project Reference:** Always use `--project-ref vnuithaqtpgbwmdvtxik` for remote operations

3. **Docker Required:** Some commands (like `db pull`, `db diff`, `status`) require Docker Desktop for local development. Commands like `db push` and `db dump` work without Docker.

4. **SQL Execution:** For executing individual SQL files, use the Supabase SQL Editor in the dashboard rather than CLI commands.

5. **Authentication:** Already configured. If you need to re-authenticate:
   ```bash
   supabase login
   ```

## Testing

Run the test script to verify everything is working:

```bash
./scripts/utilities/test-supabase-cli.sh
```

## Full Documentation

See `docs/guides/SUPABASE_CLI_SETUP.md` for complete setup instructions and troubleshooting.

