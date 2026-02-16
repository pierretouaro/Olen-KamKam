import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: string;
  metadata: any;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  read_by: string[];
  sender?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

export const useRealtimeMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial messages using stored procedure
  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase.rpc('get_conversation_messages', {
        p_conversation_id: conversationId
      });

      if (error) {
        console.error('Error fetching messages:', error);
        setLoading(false);
        return;
      }

      // Transform to Message format
      const transformed: Message[] = (data || []).map((msg: any) => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        content: msg.content,
        type: msg.type,
        metadata: msg.metadata,
        reply_to: msg.reply_to,
        edited_at: msg.edited_at,
        deleted_at: msg.deleted_at,
        created_at: msg.created_at,
        read_by: msg.read_by || [],
        sender: {
          username: msg.sender_username,
          full_name: msg.sender_full_name,
          avatar_url: msg.sender_avatar,
        },
      }));

      setMessages(transformed);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Send message using stored procedure
  const sendMessage = useCallback(async (
    content: string, 
    type: string = 'text', 
    metadata: any = {}, 
    replyTo?: string
  ) => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase.rpc('send_message', {
        p_conversation_id: conversationId,
        p_content: content,
        p_type: type,
        p_metadata: metadata,
        p_reply_to: replyTo || null
      });

      if (error) {
        console.error('Error sending message:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error sending message:', err);
      return null;
    }
  }, [conversationId]);

  // Edit message - uses direct table access but should work now
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ 
        content: newContent, 
        edited_at: new Date().toISOString() 
      })
      .eq('id', messageId);

    if (error) {
      console.error('Error editing message:', error);
    }
  }, []);

  // Delete message (soft delete)
  const deleteMessage = useCallback(async (messageId: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting message:', error);
    }
  }, []);

  // Update reactions
  const updateReactions = useCallback(async (messageId: string, reactions: string[]) => {
    const { data: current } = await supabase
      .from('messages')
      .select('metadata')
      .eq('id', messageId)
      .single();

    const { error } = await supabase
      .from('messages')
      .update({
        metadata: {
          ...(current?.metadata || {}),
          reactions: reactions
        }
      })
      .eq('id', messageId);

    if (error) {
      console.error('Error updating reactions:', error);
    }
  }, []);

  useEffect(() => {
    if (!conversationId) return;

    fetchMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          fetchMessages(); // Refetch when changes occur
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId, fetchMessages]);

  return {
    messages,
    loading,
    sendMessage,
    editMessage,
    deleteMessage,
    updateReactions,
    refresh: fetchMessages,
  };
};