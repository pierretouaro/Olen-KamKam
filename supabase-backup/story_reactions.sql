-- Story Reactions Table
CREATE TABLE IF NOT EXISTS public.story_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(story_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view reactions on any story
CREATE POLICY "Story reactions are viewable by everyone"
    ON public.story_reactions FOR SELECT USING (true);

-- Users can add their own reactions
CREATE POLICY "Users can insert their own reactions"
    ON public.story_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users can delete their own reactions"
    ON public.story_reactions FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_story_reactions_story_id ON public.story_reactions(story_id);
CREATE INDEX IF NOT EXISTS idx_story_reactions_user_id ON public.story_reactions(user_id);
