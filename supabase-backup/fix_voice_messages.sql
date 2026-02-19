-- Fix voice messages metadata support
-- Run this in Supabase SQL Editor

-- First, ensure the messages table has the metadata column (it should already)
-- Check if the get_conversation_messages function returns metadata

-- Drop and recreate the function to ensure metadata is returned
CREATE OR REPLACE FUNCTION get_conversation_messages(p_conversation_id UUID)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  sender_id UUID,
  content TEXT,
  type TEXT,
  metadata JSONB,
  reply_to UUID,
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  read_by UUID[],
  sender_username TEXT,
  sender_full_name TEXT,
  sender_avatar TEXT
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
  FROM messages m
  LEFT JOIN profiles p ON m.sender_id = p.id
  WHERE m.conversation_id = p_conversation_id
    AND m.deleted_at IS NULL
  ORDER BY m.created_at ASC;
END;
$$;

-- Also fix send_message to properly handle metadata
CREATE OR REPLACE FUNCTION send_message(
  p_conversation_id UUID,
  p_content TEXT,
  p_type TEXT DEFAULT 'text',
  p_metadata JSONB DEFAULT '{}',
  p_reply_to UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user is a participant in the conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = p_conversation_id 
    AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  
  -- Insert the message
  INSERT INTO messages (
    conversation_id,
    sender_id,
    content,
    type,
    metadata,
    reply_to,
    read_by
  ) VALUES (
    p_conversation_id,
    v_user_id,
    p_content,
    p_type,
    p_metadata,
    p_reply_to,
    ARRAY[v_user_id]
  )
  RETURNING id INTO v_message_id;
  
  -- Update conversation last_message_at
  UPDATE conversations 
  SET last_message_at = NOW() 
  WHERE id = p_conversation_id;
  
  RETURN v_message_id;
END;
$$;

-- Ensure metadata column exists on messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE messages ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_conversation_messages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION send_message(UUID, TEXT, TEXT, JSONB, UUID) TO authenticated;
