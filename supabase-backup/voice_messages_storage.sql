-- Voice Messages Storage Bucket Migration
-- Run this in Supabase SQL Editor to enable voice messaging

-- First, check if the bucket exists and create it if not
DO $$
BEGIN
  -- Create the storage bucket for voice messages if it doesn't exist
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'voice_messages',
    'voice_messages',
    true,
    52428800, -- 50MB limit
    array['audio/m4a', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/mpeg', 'audio/x-m4a', 'multipart/form-data']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = array['audio/m4a', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/mpeg', 'audio/x-m4a', 'multipart/form-data'];
END $$;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to upload voice messages" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read voice messages" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own voice messages" ON storage.objects;

-- Create policy to allow authenticated users to upload voice messages
create policy "Allow authenticated users to upload voice messages"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'voice_messages'
);

-- Create policy to allow authenticated users to read voice messages
create policy "Allow authenticated users to read voice messages"
on storage.objects for select
to authenticated
using (bucket_id = 'voice_messages');

-- Create policy to allow users to delete their own voice messages
create policy "Allow users to delete their own voice messages"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'voice_messages' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Note: The messages table should already support the metadata JSONB field
-- Voice messages will use:
-- - type: 'voice'
-- - content: '' (empty or transcript)
-- - metadata: { audio_url: string, duration: number }
