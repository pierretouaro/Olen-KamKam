-- Group Chat Feature Migration
-- Adds avatar_url to conversations and creates functions for group management

-- Add avatar_url column to conversations table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create index for faster group lookups
CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(type);

-- Drop existing functions first (to avoid return type conflicts)
DROP FUNCTION IF EXISTS public.get_conversation_details(uuid);
DROP FUNCTION IF EXISTS public.get_user_conversations(uuid);
DROP FUNCTION IF EXISTS public.get_user_conversations();

-- Function to create a group conversation
CREATE OR REPLACE FUNCTION public.create_group_conversation(
    p_name text,
    p_avatar_url text,
    p_creator_id uuid,
    p_member_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conversation_id uuid;
    v_member_id uuid;
BEGIN
    -- Create the group conversation
    INSERT INTO public.conversations (
        type,
        name,
        avatar_url,
        created_by
    ) VALUES (
        'group',
        p_name,
        p_avatar_url,
        p_creator_id
    ) RETURNING id INTO v_conversation_id;
    
    -- Add creator as participant
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conversation_id, p_creator_id);
    
    -- Add all other members
    FOREACH v_member_id IN ARRAY p_member_ids
    LOOP
        -- Skip if member is the creator (already added)
        IF v_member_id != p_creator_id THEN
            INSERT INTO public.conversation_participants (conversation_id, user_id)
            VALUES (v_conversation_id, v_member_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
    
    -- Add system message about group creation
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        content,
        type,
        metadata
    ) VALUES (
        v_conversation_id,
        p_creator_id,
        'Group created',
        'system',
        jsonb_build_object('event', 'group_created', 'creator_id', p_creator_id)
    );
    
    RETURN v_conversation_id;
END;
$$;

-- Function to update group avatar (any member can update)
CREATE OR REPLACE FUNCTION public.update_group_avatar(
    p_conversation_id uuid,
    p_user_id uuid,
    p_avatar_url text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user is a member of the group
    IF NOT EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_id = p_conversation_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'User is not a member of this group';
    END IF;
    
    -- Check if it's a group conversation
    IF NOT EXISTS (
        SELECT 1 FROM public.conversations
        WHERE id = p_conversation_id AND type = 'group'
    ) THEN
        RAISE EXCEPTION 'Not a group conversation';
    END IF;
    
    -- Update the avatar
    UPDATE public.conversations
    SET avatar_url = p_avatar_url,
        updated_at = now()
    WHERE id = p_conversation_id;
    
    -- Add system message about avatar change
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        content,
        type,
        metadata
    ) VALUES (
        p_conversation_id,
        p_user_id,
        'Group photo updated',
        'system',
        jsonb_build_object('event', 'avatar_updated', 'updated_by', p_user_id)
    );
    
    RETURN true;
END;
$$;

-- Function to get group members
CREATE OR REPLACE FUNCTION public.get_group_members(p_conversation_id uuid)
RETURNS TABLE(
    user_id uuid,
    username text,
    full_name text,
    avatar_url text,
    joined_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as user_id,
        p.username,
        p.full_name,
        p.avatar_url,
        cp.joined_at
    FROM public.conversation_participants cp
    JOIN public.profiles p ON p.id = cp.user_id
    WHERE cp.conversation_id = p_conversation_id
    ORDER BY cp.joined_at ASC;
END;
$$;

-- Update get_conversation_details to handle groups
CREATE OR REPLACE FUNCTION public.get_conversation_details(p_conversation_id uuid)
RETURNS TABLE(
    other_user_id uuid,
    other_user_name text,
    other_user_username text,
    is_online boolean,
    other_user_avatar text,
    conversation_type text,
    group_name text,
    group_avatar text,
    is_group boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conversation_type text;
BEGIN
    -- Get conversation type
    SELECT c.type INTO v_conversation_type
    FROM public.conversations c
    WHERE c.id = p_conversation_id;
    
    IF v_conversation_type = 'group' THEN
        -- Return group details
        RETURN QUERY
        SELECT 
            NULL::uuid as other_user_id,
            NULL::text as other_user_name,
            NULL::text as other_user_username,
            NULL::boolean as is_online,
            NULL::text as other_user_avatar,
            c.type as conversation_type,
            c.name as group_name,
            c.avatar_url as group_avatar,
            true as is_group
        FROM public.conversations c
        WHERE c.id = p_conversation_id;
    ELSE
        -- Return direct conversation details - explicitly filter for OTHER user
        RETURN QUERY
        SELECT 
            p.id as other_user_id,
            COALESCE(p.full_name, p.username) as other_user_name,
            p.username as other_user_username,
            (p.status = 'online') as is_online,
            p.avatar_url as other_user_avatar,
            c.type as conversation_type,
            NULL::text as group_name,
            NULL::text as group_avatar,
            false as is_group
        FROM public.conversations c
        JOIN public.conversation_participants cp ON cp.conversation_id = c.id
        JOIN public.profiles p ON p.id = cp.user_id
        WHERE c.id = p_conversation_id
        AND cp.user_id != auth.uid()  -- Only get the OTHER participant, not current user
        LIMIT 1;
    END IF;
END;
$$;

-- Update get_user_conversations to include groups
CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
    conversation_id uuid,
    conversation_type text,
    other_user_id uuid,
    other_user_name text,
    other_user_username text,
    other_user_avatar text,
    group_name text,
    group_avatar text,
    is_group boolean,
    last_message_content text,
    last_message_time timestamp with time zone,
    unread_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_convs AS (
        SELECT DISTINCT cp.conversation_id, c.type, c.name, c.avatar_url
        FROM public.conversation_participants cp
        JOIN public.conversations c ON c.id = cp.conversation_id
        WHERE cp.user_id = p_user_id
    ),
    last_messages AS (
        SELECT DISTINCT ON (m.conversation_id)
            m.conversation_id,
            m.content,
            m.created_at
        FROM public.messages m
        WHERE m.deleted_at IS NULL
        AND m.type != 'system'
        ORDER BY m.conversation_id, m.created_at DESC
    ),
    unread_counts AS (
        SELECT 
            m.conversation_id,
            COUNT(*) as count
        FROM public.messages m
        JOIN user_convs uc ON uc.conversation_id = m.conversation_id
        WHERE m.deleted_at IS NULL
        AND m.sender_id != p_user_id
        AND NOT (p_user_id = ANY(m.read_by))
        GROUP BY m.conversation_id
    ),
    -- Get other participant for direct chats only
    direct_chat_users AS (
        SELECT DISTINCT ON (cp.conversation_id)
            cp.conversation_id,
            p.id as uid,
            p.full_name,
            p.username,
            p.avatar_url as user_avatar
        FROM public.conversation_participants cp
        JOIN public.profiles p ON p.id = cp.user_id
        JOIN user_convs uc ON uc.conversation_id = cp.conversation_id
        WHERE cp.user_id != p_user_id
        AND uc.type = 'direct'
        ORDER BY cp.conversation_id, cp.joined_at
    )
    SELECT DISTINCT ON (uc.conversation_id)
        uc.conversation_id,
        uc.type as conversation_type,
        dc.uid as other_user_id,
        dc.full_name as other_user_name,
        dc.username as other_user_username,
        dc.user_avatar as other_user_avatar,
        CASE 
            WHEN uc.type = 'group' THEN uc.name
            ELSE NULL
        END as group_name,
        CASE 
            WHEN uc.type = 'group' THEN uc.avatar_url
            ELSE NULL
        END as group_avatar,
        (uc.type = 'group') as is_group,
        lm.content as last_message_content,
        lm.created_at as last_message_time,
        COALESCE(ucount.count, 0) as unread_count
    FROM user_convs uc
    LEFT JOIN direct_chat_users dc ON dc.conversation_id = uc.conversation_id
    LEFT JOIN last_messages lm ON lm.conversation_id = uc.conversation_id
    LEFT JOIN unread_counts ucount ON ucount.conversation_id = uc.conversation_id
    ORDER BY uc.conversation_id, lm.created_at DESC NULLS LAST;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_group_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_group_avatar TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_members TO authenticated;
