-- SQL to enable full_name and username editing for users
-- Run this in your Supabase SQL Editor

-- First, ensure the profiles table has the required columns
-- (These should already exist from the initial schema)

-- Check if full_name column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
  END IF;
END $$;

-- Check if username column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'username'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username TEXT NOT NULL UNIQUE;
  END IF;
END $$;

-- Check if bio column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN bio TEXT DEFAULT '';
  END IF;
END $$;

-- Check if avatar_url column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new update policy that allows updating full_name, username, bio, and avatar_url
CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Also ensure the username has a unique constraint
-- (This might already exist, so we use IF NOT EXISTS)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'profiles_username_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN unique_violation THEN NULL;
END $$;

-- Create index on username for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Verify the policies
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles';
