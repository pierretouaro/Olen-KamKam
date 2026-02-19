-- Check what's in the stories table
SELECT id, user_id, image_url, created_at, expires_at 
FROM public.stories 
ORDER BY created_at DESC 
LIMIT 10;

-- Check storage objects
SELECT name, bucket_id, owner, created_at 
FROM storage.objects 
WHERE bucket_id = 'stories'
ORDER BY created_at DESC
LIMIT 10;

-- Check bucket settings
SELECT * FROM storage.buckets WHERE id = 'stories';
