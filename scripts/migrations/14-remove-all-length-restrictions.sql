-- =====================================================
-- Migration 14: Remove All Length Restrictions
-- Convert all VARCHAR(n) fields to TEXT for maximum flexibility
-- =====================================================

DO $$ 
DECLARE
  rec RECORD;
  alter_statement TEXT;
  changes_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔍 Scanning for fields with length restrictions...';
  
  -- Find all varchar columns with length restrictions
  FOR rec IN
    SELECT 
      table_name,
      column_name,
      data_type,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('character varying', 'character')
      AND character_maximum_length IS NOT NULL
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE '_pg%'
    ORDER BY table_name, column_name
  LOOP
    -- Build ALTER statement
    alter_statement := format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE TEXT',
      rec.table_name,
      rec.column_name
    );
    
    -- Log what we're changing
    RAISE NOTICE '  % - %: %(%) → TEXT', 
      rec.table_name, 
      rec.column_name, 
      rec.data_type,
      rec.character_maximum_length;
    
    -- Execute the change
    BEGIN
      EXECUTE alter_statement;
      changes_count := changes_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '  ⚠️  Failed to alter %.%: %', 
        rec.table_name, 
        rec.column_name, 
        SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Completed: % fields converted to TEXT', changes_count;
  
END $$;

-- =====================================================
-- Add helpful comments
-- =====================================================

-- Key tables
COMMENT ON TABLE accounts IS 'Bank accounts - all text fields unlimited for flexibility';
COMMENT ON TABLE connections IS 'Banking provider connections - flexible field lengths';
COMMENT ON TABLE transactions IS 'Financial transactions - no length restrictions';
COMMENT ON TABLE entities IS 'Business entities - unlimited text fields';

-- Document the change
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📝 Migration 14 Complete: All VARCHAR length restrictions removed';
  RAISE NOTICE '   All text fields now use unlimited TEXT type for maximum flexibility';
END $$;

