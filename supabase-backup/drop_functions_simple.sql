-- Simple approach to drop all get_user_conversations functions
-- Run this in Supabase SQL Editor

-- Method 1: Try CASCADE (may not work for overloaded functions)
-- DROP FUNCTION IF EXISTS get_user_conversations() CASCADE;

-- Method 2: Use a simpler approach - drop with no args check
DO $$
BEGIN
  -- Try to drop without any argument specification
  -- PostgreSQL will drop all overloaded versions
  EXECUTE 'DROP FUNCTION get_user_conversations';
EXCEPTION 
  WHEN undefined_function THEN
    RAISE NOTICE 'Function does not exist';
  WHEN ambiguous_function THEN
    -- If ambiguous, try one by one
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN 
        SELECT format('DROP FUNCTION %s(%s)', 
          p.proname,
          pg_get_function_identity_arguments(p.oid)
        ) as sql
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'get_user_conversations'
        AND n.nspname = 'public'
      LOOP
        RAISE NOTICE 'Executing: %', r.sql;
        EXECUTE r.sql;
      END LOOP;
    END;
END $$;

-- Verify all are gone
SELECT count(*) as remaining_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_user_conversations'
AND n.nspname = 'public';
