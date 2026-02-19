-- Drop ALL versions of get_user_conversations function
-- Handles default values and complex signatures

DO $$
DECLARE
  func_record RECORD;
  drop_sql TEXT;
BEGIN
  FOR func_record IN 
    SELECT oid, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc 
    WHERE proname = 'get_user_conversations'
  LOOP
    drop_sql := format('DROP FUNCTION IF EXISTS get_user_conversations(%s)', 
      COALESCE(func_record.args, ''));
    RAISE NOTICE 'Dropping: %', drop_sql;
    EXECUTE drop_sql;
  END LOOP;
END $$;

-- Alternative approach: drop everything with CASCADE
-- DROP FUNCTION IF EXISTS get_user_conversations() CASCADE;

-- Verify they're all gone
SELECT count(*) as remaining_functions
FROM pg_proc 
WHERE proname = 'get_user_conversations';
