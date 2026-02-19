-- Fix stories storage and visibility issues

-- Ensure the bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'stories';

-- If bucket doesn't exist, create it
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stories', 'stories', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Ensure stories table has proper RLS
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Stories are viewable by everyone" ON public.stories;
DROP POLICY IF EXISTS "Users can insert their own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can delete their own stories" ON public.stories;

CREATE POLICY "Stories are viewable by everyone"
    ON public.stories FOR SELECT USING (true);

CREATE POLICY "Users can insert their own stories"
    ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories"
    ON public.stories FOR DELETE USING (auth.uid() = user_id);

-- Storage policies - make sure objects are accessible
DROP POLICY IF EXISTS "Stories bucket public access" ON storage.objects;
DROP POLICY IF EXISTS "Stories images are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own story images" ON storage.objects;

-- Allow all authenticated users to upload to stories
CREATE POLICY "Users can upload story images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'stories');

-- Allow anyone to view story images
CREATE POLICY "Stories are publicly viewable"
    ON storage.objects
    FOR SELECT
    TO public, authenticated
    USING (bucket_id = 'stories');

-- Allow users to delete their own story images
CREATE POLICY "Users can delete story images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Check existing stories
SELECT id, user_id, image_url, created_at FROM public.stories LIMIT 10;
