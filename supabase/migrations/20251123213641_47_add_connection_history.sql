-- Migration 47: Add connection_history table for reconnection tracking
-- 
-- This table tracks connection lifecycle events including:
-- - Reconnections (when tokens expire and user reconnects)
-- - Connection deletions
-- - Account linking/unlinking
-- - Audit trail for production systems

CREATE TABLE IF NOT EXISTS public.connection_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  previous_connection_id UUID REFERENCES public.connections(id) ON DELETE SET NULL,
  
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',
    'reconnection',
    'token_refresh',
    'deleted',
    'expired',
    'manual_disconnect',
    'account_linked',
    'account_unlinked'
  )),
  
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_connection_history_connection 
  ON public.connection_history(connection_id);

CREATE INDEX IF NOT EXISTS idx_connection_history_tenant 
  ON public.connection_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_connection_history_event_type 
  ON public.connection_history(event_type);

CREATE INDEX IF NOT EXISTS idx_connection_history_created_at 
  ON public.connection_history(created_at DESC);

-- RLS policies
ALTER TABLE public.connection_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's connection history"
  ON public.connection_history FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert connection history for their tenant"
  ON public.connection_history FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- Add helpful comments
COMMENT ON TABLE public.connection_history IS 'Tracks connection lifecycle events including reconnections, deletions, and token refreshes for audit and recovery';
COMMENT ON COLUMN public.connection_history.event_type IS 'Type of connection event: created, reconnection, token_refresh, deleted, expired, manual_disconnect, account_linked, account_unlinked';
COMMENT ON COLUMN public.connection_history.event_data IS 'JSON blob with event-specific data (matched_accounts, linked_transactions, confidence, etc.)';
COMMENT ON COLUMN public.connection_history.previous_connection_id IS 'For reconnections, the ID of the previous connection that was replaced';

-- Add metadata columns to connections table for reconnection tracking
ALTER TABLE public.connections 
  ADD COLUMN IF NOT EXISTS is_reconnection BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconnected_from UUID REFERENCES public.connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconnection_confidence TEXT CHECK (reconnection_confidence IN ('high', 'medium', 'low'));

COMMENT ON COLUMN public.connections.is_reconnection IS 'True if this connection was detected as a reconnection to previously connected accounts';
COMMENT ON COLUMN public.connections.reconnected_from IS 'ID of the previous connection that this reconnected from';
COMMENT ON COLUMN public.connections.reconnection_confidence IS 'Confidence level of reconnection detection: high (exact match), medium (fuzzy match), low (manual review needed)';

