-- Fix conversation preview - DROP ALL versions and recreate
-- Run this in Supabase SQL Editor

-- Drop ALL versions of the function (with any parameter combination)
DROP FUNCTION IF EXISTS get_user_conversations();
DROP FUNCTION IF EXISTS get_user_conversations(UUID);
DROP FUNCTION IF EXISTS get_user_conversations(INT);
DROP FUNCTION IF EXISTS get_user_conversations(TEXT);

-- Now create the single correct version
CREATE OR REPLACE FUNCTION get_user_conversations()
RETURNS TABLE (
  conversation_id UUID,
  is_group BOOLEAN,
  group_name TEXT,
  group_avatar TEXT,
  other_user_id UUID,
  other_user_name TEXT,
  other_user_username TEXT,
  other_user_avatar TEXT,
  is_online BOOLEAN,
  last_message_content TEXT,
  last_message_type TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_conversations AS (
    SELECT 
      cp.conversation_id,
      c.is_group,
      c.group_name,
      c.group_avatar,
      c.last_message_at
    FROM conversation_participants cp
    JOIN conversations c ON cp.conversation_id = c.id
    WHERE cp.user_id = auth.uid()
      AND cp.left_at IS NULL
  ),
  other_participants AS (
    SELECT 
      cp.conversation_id,
      p.id as other_user_id,
      p.full_name as other_user_name,
      p.username as other_user_username,
      p.avatar_url as other_user_avatar,
      p.is_online
    FROM conversation_participants cp
    JOIN profiles p ON cp.user_id = p.id
    WHERE cp.conversation_id IN (SELECT conversation_id FROM user_conversations)
      AND cp.user_id != auth.uid()
      AND cp.left_at IS NULL
  ),
  last_messages AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content as last_message_content,
      m.type as last_message_type,
      m.created_at as last_message_time
    FROM messages m
    WHERE m.conversation_id IN (SELECT conversation_id FROM user_conversations)
      AND m.deleted_at IS NULL
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      m.conversation_id,
      COUNT(*) as unread_count
    FROM messages m
    WHERE m.conversation_id IN (SELECT conversation_id FROM user_conversations)
      AND m.deleted_at IS NULL
      AND NOT (auth.uid() = ANY(m.read_by))
      AND m.sender_id != auth.uid()
    GROUP BY m.conversation_id
  )
  SELECT 
    uc.conversation_id,
    uc.is_group,
    uc.group_name,
    uc.group_avatar,
    op.other_user_id,
    op.other_user_name,
    op.other_user_username,
    op.other_user_avatar,
    op.is_online,
    lm.last_message_content,
    lm.last_message_type,
    lm.last_message_time,
    COALESCE(uc_unread.unread_count, 0) as unread_count
  FROM user_conversations uc
  LEFT JOIN other_participants op ON uc.conversation_id = op.conversation_id
  LEFT JOIN last_messages lm ON uc.conversation_id = lm.conversation_id
  LEFT JOIN unread_counts uc_unread ON uc.conversation_id = uc_unread.conversation_id
  ORDER BY uc.last_message_at DESC NULLS LAST;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_conversations() TO authenticated;

-- Verify the function was created correctly
SELECT 
  proname as function_name,
  proargtypes::regtype[] as argument_types,
  prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'get_user_conversations';
