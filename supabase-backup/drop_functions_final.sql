-- Final approach: Drop all get_user_conversations functions
-- This handles the DEFAULT value issue properly

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT 
      'DROP FUNCTION IF EXISTS ' || 
      n.nspname || '.' || 
      p.proname || '(' ||
      pg_get_function_identity_arguments(p.oid) ||
      ')' as sql_stmt
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'get_user_conversations'
    AND n.nspname = 'public'
  LOOP
    RAISE NOTICE 'Dropping: %', r.sql_stmt;
    EXECUTE r.sql_stmt;
  END LOOP;
END $$;

-- Check if any remain
SELECT 
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_user_conversations'
AND n.nspname = 'public';
