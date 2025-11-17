-- Migration 27: Add sync observability columns to provider_accounts
-- Tracks per-provider-account sync status, errors, and duration metrics

ALTER TABLE provider_accounts
  ADD COLUMN IF NOT EXISTS last_sync_status TEXT DEFAULT 'idle'
    CHECK (last_sync_status IN ('idle', 'success', 'error')),
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_duration_ms INTEGER;

-- Backfill existing rows: mark previously synced accounts as success, others idle
UPDATE provider_accounts
SET last_sync_status = CASE
    WHEN last_synced_at IS NOT NULL THEN 'success'
    ELSE 'idle'
  END
WHERE last_sync_status IS NULL;

