-- Fix get_conversation_details to return the OTHER user, not the current user
-- This fixes the bug where the header shows the current user's info instead of the chat partner

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
