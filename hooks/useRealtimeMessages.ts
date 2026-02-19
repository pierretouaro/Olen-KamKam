import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { messageDb } from '../lib/messageDatabase';

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
  synced?: boolean;
}

const MESSAGES_PER_PAGE = 50;

export const useRealtimeMessages = (conversationId: string | null, userId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  
  // Use refs to track state in callbacks without dependencies
  const messagesRef = useRef<Message[]>([]);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // Load initial messages from local DB first (instant)
  const loadLocalMessages = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      const localMsgs = await messageDb.getMessages(conversationId, MESSAGES_PER_PAGE);
      
      if (localMsgs.length > 0) {
        const transformed = localMsgs.map(dbMsg => ({
          id: dbMsg.id,
          conversation_id: dbMsg.conversation_id,
          sender_id: dbMsg.sender_id,
          content: dbMsg.content,
          type: dbMsg.type,
          metadata: JSON.parse(dbMsg.metadata || '{}'),
          reply_to: dbMsg.reply_to,
          edited_at: dbMsg.edited_at,
          deleted_at: dbMsg.deleted_at,
          created_at: dbMsg.created_at,
          read_by: JSON.parse(dbMsg.read_by || '[]'),
          sender: {
            username: dbMsg.sender_username,
            full_name: dbMsg.sender_full_name,
            avatar_url: dbMsg.sender_avatar,
          },
          synced: dbMsg.synced === 1,
        }));
        
        setMessages(transformed.reverse()); // Reverse to get oldest first
        setLoading(false); // Show local data immediately
      }
    } catch (error) {
      console.error('Error loading local messages:', error);
    }
  }, [conversationId]);

  // Fetch messages from server with pagination
  const fetchMessages = useCallback(async (isInitial: boolean = true) => {
    if (!conversationId) {
      setLoading(false);
      return;
    }
    
    if (isInitial) {
      setLoading(true);
      // First load from local DB for instant UI
      await loadLocalMessages();
    } else {
      if (loadingMoreRef.current || !hasMoreRef.current) return;
      setLoadingMore(true);
      loadingMoreRef.current = true;
    }
    
    try {
      const oldestMessage = isInitial ? null : messagesRef.current[0];
      const beforeDate = oldestMessage?.created_at || new Date().toISOString();
      
      // Use RPC for paginated fetch
      const { data, error } = await supabase.rpc('get_conversation_messages_paginated', {
        p_conversation_id: conversationId,
        p_limit: MESSAGES_PER_PAGE,
        p_before: beforeDate,
      });

      if (error) {
        console.error('Error fetching messages:', error);
        setLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
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
        synced: true,
      }));

      // Save to local DB for next time
      if (transformed.length > 0) {
        await messageDb.saveMessages(transformed, conversationId);
      }

      // Update state
      if (isInitial) {
        setMessages(transformed.reverse());
        setHasMore(transformed.length === MESSAGES_PER_PAGE);
      } else {
        // Prepend older messages
        setMessages(prev => [...transformed.reverse(), ...prev]);
        setHasMore(transformed.length === MESSAGES_PER_PAGE);
      }
      
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [conversationId, loadLocalMessages]);

  // Load more messages (pagination)
  const loadMore = useCallback(() => {
    if (!loadingMoreRef.current && hasMoreRef.current) {
      fetchMessages(false);
    }
  }, [fetchMessages]);

  // Optimistic send message
  const sendMessage = useCallback(async (
    content: string, 
    type: string = 'text', 
    metadata: any = {}, 
    replyTo?: string
  ) => {
    if (!conversationId || !userId) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: userId,
      content,
      type,
      metadata,
      reply_to: replyTo || null,
      edited_at: null,
      deleted_at: null,
      created_at: now,
      read_by: [userId],
      sender: {
        username: '',
        full_name: 'You',
        avatar_url: '',
      },
      synced: false,
    };

    // Add to pending and show immediately
    setPendingMessages(prev => [...prev, optimisticMessage]);
    setMessages(prev => [...prev, optimisticMessage]);

    // Save to local DB as pending
    await messageDb.savePendingMessage(optimisticMessage);

    try {
      // Send to server
      const { data, error } = await supabase.rpc('send_message', {
        p_conversation_id: conversationId,
        p_content: content,
        p_type: type,
        p_metadata: metadata,
        p_reply_to: replyTo || null
      });

      if (error) {
        console.error('Error sending message:', error);
        // Keep the pending message but mark as failed
        return null;
      }

      // Update local DB with real ID
      if (data && data.id) {
        await messageDb.updateMessageId(tempId, data.id);
        
        // Update UI with real message
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, id: data.id, synced: true }
              : msg
          )
        );
        setPendingMessages(prev => prev.filter(m => m.id !== tempId));
      }

      return data;
    } catch (err) {
      console.error('Error sending message:', err);
      return null;
    }
  }, [conversationId, userId]);

  // Edit message
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
    // Optimistic delete
    setMessages(prev => prev.filter(m => m.id !== messageId));
    await messageDb.deleteMessage(messageId);

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
    if (!conversationId) {
      setMessages([]);
      setHasMore(true);
      setLoading(false);
      return;
    }

    // Initialize DB and load messages
    messageDb.init().then(() => {
      fetchMessages(true);
    });

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
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as any;
            // Don't add if it's our own optimistic message
            if (!newMsg.id.startsWith('temp_')) {
              const transformed: Message = {
                id: newMsg.id,
                conversation_id: newMsg.conversation_id,
                sender_id: newMsg.sender_id,
                content: newMsg.content,
                type: newMsg.type,
                metadata: newMsg.metadata,
                reply_to: newMsg.reply_to,
                edited_at: newMsg.edited_at,
                deleted_at: newMsg.deleted_at,
                created_at: newMsg.created_at,
                read_by: newMsg.read_by || [],
                synced: true,
              };
              
              // Add to local DB and state
              messageDb.saveMessages([transformed], conversationId);
              setMessages(prev => {
                if (prev.find(m => m.id === transformed.id)) return prev;
                return [...prev, transformed];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as any;
            setMessages(prev => 
              prev.map(msg => 
                msg.id === updatedMsg.id 
                  ? { ...msg, ...updatedMsg, synced: true }
                  : msg
              )
            );
          }
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
    loadingMore,
    hasMore,
    pendingMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    updateReactions,
    loadMore,
    refresh: () => fetchMessages(true),
  };
};
