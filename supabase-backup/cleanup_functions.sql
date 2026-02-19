-- Emergency cleanup - Remove ALL versions of get_user_conversations
-- This handles the function overloading issue

-- First, let's see what we have
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as argument_list,
  proargtypes::regtype[] as argument_types
FROM pg_proc 
WHERE proname = 'get_user_conversations';

-- Drop each specific version by finding them dynamically
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN 
    SELECT oid, pg_get_function_arguments(oid) as args
    FROM pg_proc 
    WHERE proname = 'get_user_conversations'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS get_user_conversations(%s)', 
      CASE WHEN func_record.args = '' THEN '' ELSE func_record.args END);
  END LOOP;
END $$;

-- Alternative: drop without arguments which might work in some cases
-- (but the DO block above should handle it)

-- Verify all are gone
SELECT count(*) as remaining_functions
FROM pg_proc 
WHERE proname = 'get_user_conversations';
