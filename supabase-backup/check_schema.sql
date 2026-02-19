-- Check what columns exist in the conversations table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversations' 
ORDER BY ordinal_position;

-- Also check the existing function
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as args
FROM pg_proc 
WHERE proname = 'get_user_conversations';
