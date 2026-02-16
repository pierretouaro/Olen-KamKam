-- Create notes table for Instagram-style notes feature
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT note_content_length CHECK (char_length(content) <= 60)
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_expires_at ON public.notes(expires_at);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Users can view all non-expired notes
CREATE POLICY "Users can view all notes"
    ON public.notes FOR SELECT
    TO authenticated
    USING (expires_at > NOW());

-- Users can insert their own notes
CREATE POLICY "Users can insert their own notes"
    ON public.notes FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own notes
CREATE POLICY "Users can update their own notes"
    ON public.notes FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notes
CREATE POLICY "Users can delete their own notes"
    ON public.notes FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Create function to automatically clean up expired notes
CREATE OR REPLACE FUNCTION public.delete_expired_notes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.notes WHERE expires_at <= NOW();
END;
$$;

-- Create a scheduled job to clean up expired notes (run every hour)
-- Note: This requires pg_cron extension to be enabled
-- SELECT cron.schedule('cleanup-expired-notes', '0 * * * *', 'SELECT public.delete_expired_notes()');
