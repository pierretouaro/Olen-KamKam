-- Migration to add haptic message type support
-- This extends the messages table to support haptic reactions

-- Note: The messages table already has a 'type' column based on the schema
-- We just need to ensure it can store 'haptic' as a value

-- Update the send_message function to support haptic type
CREATE OR REPLACE FUNCTION public.send_message(
  p_conversation_id uuid,
  p_content text,
  p_type text DEFAULT 'text'::text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_reply_to uuid DEFAULT NULL::uuid
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_message_id uuid;
  v_sender_id uuid;
BEGIN
  -- Get the sender ID from the current user
  v_sender_id := auth.uid();
  
  -- Verify user is a participant in the conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = v_sender_id
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
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
    v_sender_id,
    p_content,
    p_type,
    p_metadata,
    p_reply_to,
    ARRAY[v_sender_id]
  )
  RETURNING id INTO v_message_id;
  
  -- Update conversation's updated_at timestamp
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = p_conversation_id;
  
  RETURN v_message_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text, text, jsonb, uuid) TO authenticated;

COMMENT ON FUNCTION public.send_message IS 'Sends a message to a conversation, now supporting haptic reactions';
