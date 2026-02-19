-- Create stories table to replace notes functionality
-- First drop if exists to avoid conflicts
DROP TABLE IF EXISTS public.stories CASCADE;

-- Create the table fresh - reference profiles instead of auth.users for easier joins
CREATE TABLE public.stories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Enable RLS
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Drop notes table if it exists
DROP TABLE IF EXISTS public.notes CASCADE;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Stories are viewable by everyone" ON public.stories;
DROP POLICY IF EXISTS "Users can insert their own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can update their own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can delete their own stories" ON public.stories;

-- Policies for stories
CREATE POLICY "Stories are viewable by everyone"
    ON public.stories
    FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own stories"
    ON public.stories
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stories"
    ON public.stories
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories"
    ON public.stories
    FOR DELETE
    USING (auth.uid() = user_id);

-- Storage policies - first drop existing
DROP POLICY IF EXISTS "Stories bucket public access" ON storage.objects;
DROP POLICY IF EXISTS "Stories images are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own story images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own story images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own story images" ON storage.objects;

-- Storage policies - simplified for stories bucket
CREATE POLICY "Stories bucket public access"
    ON storage.objects FOR ALL
    TO public, authenticated
    USING (bucket_id = 'stories')
    WITH CHECK (bucket_id = 'stories');

-- Create function to clean up expired stories (can be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.stories WHERE expires_at < NOW();
END;
$$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON public.stories(expires_at);

-- Update activity tracking for stories
-- First drop existing note trigger if it exists
DROP TRIGGER IF EXISTS on_note_insert ON public.notes;
DROP FUNCTION IF EXISTS public.create_note_activity();

-- Create function for story activity
CREATE OR REPLACE FUNCTION public.create_story_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.activity_log (actor_id, activity_type, new_value)
    VALUES (NEW.user_id, 'story_added', 'New story');
    
    RETURN NEW;
END;
$$;

-- Create trigger for new stories
DROP TRIGGER IF EXISTS on_story_insert ON public.stories;
CREATE TRIGGER on_story_insert
    AFTER INSERT ON public.stories
    FOR EACH ROW
    EXECUTE FUNCTION public.create_story_activity();

-- Update activity_log constraint to include story_added
-- First check if the constraint exists and drop it
ALTER TABLE public.activity_log 
DROP CONSTRAINT IF EXISTS activity_log_activity_type_check;

-- Add new constraint with story_added
ALTER TABLE public.activity_log 
ADD CONSTRAINT activity_log_activity_type_check 
CHECK (activity_type IN ('bio_added', 'bio_changed', 'username_changed', 'full_name_changed', 'story_added', 'joined_olen'));

-- Note: To create the 'stories' bucket, go to Supabase Dashboard > Storage > New Bucket
-- Name: stories, Public: true, File size limit: 50MB, Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
