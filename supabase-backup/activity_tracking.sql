-- Activity/Updates tracking system
-- Run this in your Supabase SQL Editor

-- Create activity log table to track profile changes, new users, notes
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('bio_added', 'bio_changed', 'username_changed', 'full_name_changed', 'note_added', 'joined_olen')),
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create seen activities table to track what each user has viewed
CREATE TABLE IF NOT EXISTS public.seen_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES public.activity_log(id) ON DELETE CASCADE,
    seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, activity_id)
);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seen_activities ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_id ON public.activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON public.activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_seen_activities_user_id ON public.seen_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_seen_activities_activity_id ON public.seen_activities(activity_id);

-- RLS Policies for activity_log
-- Users can view activities from people they have conversations with
CREATE POLICY "Users can view activities from contacts"
    ON public.activity_log FOR SELECT
    TO authenticated
    USING (
        actor_id IN (
            SELECT DISTINCT 
                CASE 
                    WHEN cp1.user_id = auth.uid() THEN cp2.user_id
                    ELSE cp1.user_id
                END
            FROM public.conversation_participants cp1
            JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
            WHERE cp1.user_id = auth.uid() AND cp2.user_id != auth.uid()
        )
        OR actor_id = auth.uid()
    );

-- System can insert activities (via triggers/functions)
CREATE POLICY "System can insert activities"
    ON public.activity_log FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- RLS Policies for seen_activities
CREATE POLICY "Users can view their own seen activities"
    ON public.seen_activities FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can mark activities as seen"
    ON public.seen_activities FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Function to create activity when profile is updated
CREATE OR REPLACE FUNCTION public.create_profile_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
BEGIN
    v_actor_id := NEW.id;

    -- Check for bio changes
    IF OLD.bio IS DISTINCT FROM NEW.bio THEN
        IF OLD.bio IS NULL OR OLD.bio = '' THEN
            INSERT INTO public.activity_log (actor_id, activity_type, new_value)
            VALUES (v_actor_id, 'bio_added', NEW.bio);
        ELSE
            INSERT INTO public.activity_log (actor_id, activity_type, old_value, new_value)
            VALUES (v_actor_id, 'bio_changed', OLD.bio, NEW.bio);
        END IF;
    END IF;

    -- Check for username changes
    IF OLD.username IS DISTINCT FROM NEW.username THEN
        INSERT INTO public.activity_log (actor_id, activity_type, old_value, new_value)
        VALUES (v_actor_id, 'username_changed', OLD.username, NEW.username);
    END IF;

    -- Check for full_name changes
    IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
        INSERT INTO public.activity_log (actor_id, activity_type, old_value, new_value)
        VALUES (v_actor_id, 'full_name_changed', OLD.full_name, NEW.full_name);
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger for profile updates
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
CREATE TRIGGER on_profile_update
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_profile_activity();

-- Function to create activity when note is added
CREATE OR REPLACE FUNCTION public.create_note_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.activity_log (actor_id, activity_type, new_value)
    VALUES (NEW.user_id, 'note_added', NEW.content);
    
    RETURN NEW;
END;
$$;

-- Trigger for new notes
DROP TRIGGER IF EXISTS on_note_insert ON public.notes;
CREATE TRIGGER on_note_insert
    AFTER INSERT ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.create_note_activity();

-- Function to create activity when user joins (profile created)
CREATE OR REPLACE FUNCTION public.create_joined_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.activity_log (actor_id, activity_type)
    VALUES (NEW.id, 'joined_olen');
    
    RETURN NEW;
END;
$$;

-- Trigger for new user joined
DROP TRIGGER IF EXISTS on_profile_insert ON public.profiles;
CREATE TRIGGER on_profile_insert
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_joined_activity();

-- Function to get unseen activity count for a user
CREATE OR REPLACE FUNCTION public.get_unseen_activity_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.activity_log al
    WHERE al.actor_id IN (
        SELECT DISTINCT 
            CASE 
                WHEN cp1.user_id = p_user_id THEN cp2.user_id
                ELSE cp1.user_id
            END
        FROM public.conversation_participants cp1
        JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
        WHERE cp1.user_id = p_user_id AND cp2.user_id != p_user_id
    )
    AND al.actor_id != p_user_id
    AND NOT EXISTS (
        SELECT 1 FROM public.seen_activities sa 
        WHERE sa.user_id = p_user_id AND sa.activity_id = al.id
    );
    
    RETURN v_count;
END;
$$;

-- Function to get activities for a user
CREATE OR REPLACE FUNCTION public.get_user_activities(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    actor_id UUID,
    actor_name TEXT,
    actor_username TEXT,
    actor_avatar TEXT,
    activity_type TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    is_seen BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.actor_id,
        p.full_name as actor_name,
        p.username as actor_username,
        p.avatar_url as actor_avatar,
        al.activity_type,
        al.old_value,
        al.new_value,
        al.created_at,
        EXISTS (
            SELECT 1 FROM public.seen_activities sa 
            WHERE sa.user_id = p_user_id AND sa.activity_id = al.id
        ) as is_seen
    FROM public.activity_log al
    JOIN public.profiles p ON p.id = al.actor_id
    WHERE al.actor_id IN (
        SELECT DISTINCT 
            CASE 
                WHEN cp1.user_id = p_user_id THEN cp2.user_id
                ELSE cp1.user_id
            END
        FROM public.conversation_participants cp1
        JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
        WHERE cp1.user_id = p_user_id AND cp2.user_id != p_user_id
    )
    AND al.actor_id != p_user_id
    ORDER BY al.created_at DESC;
END;
$$;
