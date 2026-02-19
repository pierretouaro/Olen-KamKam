-- Add paginated message fetching function
CREATE OR REPLACE FUNCTION public.get_conversation_messages_paginated(
  p_conversation_id uuid,
  p_limit integer DEFAULT 50,
  p_before timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  content text,
  type text,
  metadata jsonb,
  reply_to uuid,
  edited_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone,
  read_by uuid[],
  sender_username text,
  sender_full_name text,
  sender_avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.conversation_id,
    m.sender_id,
    m.content,
    m.type,
    m.metadata,
    m.reply_to,
    m.edited_at,
    m.deleted_at,
    m.created_at,
    m.read_by,
    p.username as sender_username,
    p.full_name as sender_full_name,
    p.avatar_url as sender_avatar
  FROM 
    messages m
    LEFT JOIN profiles p ON m.sender_id = p.id
  WHERE 
    m.conversation_id = p_conversation_id
    AND m.deleted_at IS NULL
    AND (p_before IS NULL OR m.created_at < p_before)
  ORDER BY 
    m.created_at DESC
  LIMIT 
    p_limit;
END;
$$;

-- Grant permissions
GRANT ALL ON FUNCTION public.get_conversation_messages_paginated(uuid, integer, timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.get_conversation_messages_paginated(uuid, integer, timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.get_conversation_messages_paginated(uuid, integer, timestamp with time zone) TO service_role;
