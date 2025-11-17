-- Migration 26: ensure provider_accounts sync_enabled defaults to true
-- Context: transaction sync filters on sync_enabled=true; some legacy rows had NULL

ALTER TABLE provider_accounts
  ALTER COLUMN sync_enabled SET DEFAULT true;

UPDATE provider_accounts
  SET sync_enabled = true
  WHERE sync_enabled IS NULL;

