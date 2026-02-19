import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface GroupMember {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  joined_at: string;
}

export function useGroups() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGroup = useCallback(async (
    name: string,
    avatarUrl: string | null,
    memberIds: string[]
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: rpcError } = await supabase.rpc('create_group_conversation', {
        p_name: name,
        p_avatar_url: avatarUrl,
        p_creator_id: (await supabase.auth.getUser()).data.user?.id,
        p_member_ids: memberIds
      });

      if (rpcError) throw rpcError;
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateGroupAvatar = useCallback(async (
    conversationId: string,
    avatarUrl: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { data, error: rpcError } = await supabase.rpc('update_group_avatar', {
        p_conversation_id: conversationId,
        p_user_id: userId,
        p_avatar_url: avatarUrl
      });

      if (rpcError) throw rpcError;
      return data;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getGroupMembers = useCallback(async (
    conversationId: string
  ): Promise<GroupMember[]> => {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_group_members', {
        p_conversation_id: conversationId
      });

      if (rpcError) throw rpcError;
      return data || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, []);

  const uploadGroupAvatar = useCallback(async (
    uri: string,
    conversationId: string
  ): Promise<string | null> => {
    try {
      // Fetch the image as blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Create unique filename
      const filename = `group-${conversationId}-${Date.now()}.jpg`;
      const filePath = `group-avatars/${filename}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      return publicUrl;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  return {
    createGroup,
    updateGroupAvatar,
    getGroupMembers,
    uploadGroupAvatar,
    loading,
    error
  };
}
