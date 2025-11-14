-- =====================================================
-- Create exec_sql Function for Programmatic SQL Execution
-- =====================================================
-- This function allows TypeScript scripts to execute raw SQL
-- SECURITY NOTE: Only accessible via service role key
-- =====================================================

CREATE OR REPLACE FUNCTION public.exec_sql(sql TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  rows_affected INTEGER;
BEGIN
  -- Execute the SQL
  EXECUTE sql;
  
  -- Get rows affected (if applicable)
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'rows_affected', rows_affected,
    'message', 'SQL executed successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Return error details
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'error_code', SQLSTATE,
    'hint', 'Check SQL syntax and permissions'
  );
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.exec_sql(TEXT) IS 
'Execute raw SQL statements programmatically. Returns JSON with success status and error details if any. Only accessible with service role key for security.';

-- =====================================================
-- Grant permissions (service role only)
-- =====================================================
-- Note: Service role bypasses RLS, so this is inherently secure
-- Regular users (anon role) should NOT have access to this function

REVOKE ALL ON FUNCTION public.exec_sql(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;

-- =====================================================
-- Test the function
-- =====================================================
-- Uncomment to test:
-- SELECT exec_sql('SELECT NOW()');
-- SELECT exec_sql('CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY)');

DO $$
BEGIN
  RAISE NOTICE '✅ exec_sql function created successfully!';
  RAISE NOTICE '📝 Usage: SELECT exec_sql(''YOUR SQL HERE'')';
  RAISE NOTICE '🔒 Security: Only accessible via service role key';
END $$;

