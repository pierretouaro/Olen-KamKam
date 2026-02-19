-- Fix for ambiguous column reference in get_user_conversations
DROP FUNCTION IF EXISTS get_user_conversations();

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
  WITH uc AS (
    SELECT 
      cp.conversation_id as cid,
      c.type = 'group' as is_grp,
      c.name as grp_name,
      c.avatar_url as grp_avatar
    FROM conversation_participants cp
    JOIN conversations c ON cp.conversation_id = c.id
    WHERE cp.user_id = auth.uid()
  ),
  op AS (
    SELECT 
      cp.conversation_id as cid,
      p.id as ouid,
      p.full_name as ouname,
      p.username as ouusername,
      p.avatar_url as ouavatar,
      false as ionline
    FROM conversation_participants cp
    JOIN profiles p ON cp.user_id = p.id
    WHERE cp.conversation_id IN (SELECT cid FROM uc)
      AND cp.user_id != auth.uid()
  ),
  lm AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id as cid,
      m.content as lcontent,
      m.type as ltype,
      m.created_at as ltime
    FROM messages m
    WHERE m.conversation_id IN (SELECT cid FROM uc)
      AND m.deleted_at IS NULL
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unr AS (
    SELECT 
      m.conversation_id as cid,
      COUNT(*) as ucount
    FROM messages m
    WHERE m.conversation_id IN (SELECT cid FROM uc)
      AND m.deleted_at IS NULL
      AND NOT (auth.uid() = ANY(m.read_by))
      AND m.sender_id != auth.uid()
    GROUP BY m.conversation_id
  )
  SELECT 
    uc.cid,
    uc.is_grp,
    uc.grp_name,
    uc.grp_avatar,
    op.ouid,
    op.ouname,
    op.ouusername,
    op.ouavatar,
    op.ionline,
    lm.lcontent,
    lm.ltype,
    lm.ltime,
    COALESCE(unr.ucount, 0)
  FROM uc
  LEFT JOIN op ON uc.cid = op.cid
  LEFT JOIN lm ON uc.cid = lm.cid
  LEFT JOIN unr ON uc.cid = unr.cid
  ORDER BY lm.ltime DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_conversations() TO authenticated;
