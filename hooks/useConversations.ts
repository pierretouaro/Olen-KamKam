import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useConversations = () => {
  const getOrCreateConversation = useCallback(async (otherUserId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    console.log('Creating conversation between:', user.id, 'and', otherUserId);

    try {
      // Use the stored procedure that bypasses RLS to avoid infinite recursion
      const { data, error } = await supabase.rpc('create_conversation', {
        other_user_id: otherUserId
      });

      if (error) {
        console.error('RPC Error:', error);
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error('No conversation ID returned');
      }

      console.log('Successfully created/found conversation:', data);
      return data;

    } catch (error: any) {
      console.error('Full error:', error);
      throw new Error(error.message || 'Failed to create conversation');
    }
  }, []);

  return { getOrCreateConversation };
};