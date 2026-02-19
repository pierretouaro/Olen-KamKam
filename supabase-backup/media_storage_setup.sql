-- Create storage buckets for media files
-- Run this in your Supabase SQL Editor

-- Create buckets for different media types
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('images', 'images', true),
  ('videos', 'videos', true),
  ('files', 'files', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to upload images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own images" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;

-- Set up RLS policies for images bucket
CREATE POLICY "Allow authenticated users to upload images" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'images');

CREATE POLICY "Allow authenticated users to read images" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'images');

CREATE POLICY "Allow public read access to images" 
ON storage.objects FOR SELECT TO anon 
USING (bucket_id = 'images');

-- Set up RLS policies for videos bucket
CREATE POLICY "Allow authenticated users to upload videos" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Allow authenticated users to read videos" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'videos');

CREATE POLICY "Allow public read access to videos" 
ON storage.objects FOR SELECT TO anon 
USING (bucket_id = 'videos');

-- Set up RLS policies for files bucket
CREATE POLICY "Allow authenticated users to upload files" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'files');

CREATE POLICY "Allow authenticated users to read files" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'files');

CREATE POLICY "Allow public read access to files" 
ON storage.objects FOR SELECT TO anon 
USING (bucket_id = 'files');

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete their own images" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow users to delete their own videos" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow users to delete their own files" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);
