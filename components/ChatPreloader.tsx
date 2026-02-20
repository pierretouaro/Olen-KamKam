import { useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import { messageDb } from '../lib/messageDatabase';
import { mediaCache } from '../lib/mediaCache';

interface Conversation {
  id: string;
  last_message_at: string;
}

// Preload messages and media for recent conversations
export function useChatPreloader() {
  const preloadConversations = useCallback(async () => {
    try {
      // Get user's conversations
      const { data: conversations, error } = await supabase.rpc('get_user_conversations');
      
      if (error || !conversations) return;

      // Sort by most recent and take top 5
      const recentConversations = conversations
        .sort((a: any, b: any) => 
          new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
        )
        .slice(0, 5);

      // Preload each conversation in background
      for (const conv of recentConversations) {
        await preloadConversation(conv.conversation_id);
      }
    } catch (error) {
      console.log('Preload error:', error);
    }
  }, []);

  const preloadConversation = useCallback(async (conversationId: string) => {
    try {
      // Check if we already have recent messages
      const lastSync = await messageDb.getLastSyncTime(conversationId);
      const lastSyncTime = lastSync ? new Date(lastSync).getTime() : 0;
      const now = Date.now();
      
      // Only fetch if messages are older than 5 minutes
      if (now - lastSyncTime < 5 * 60 * 1000) {
        // Just preload media for existing messages
        await preloadMediaForConversation(conversationId);
        return;
      }

      // Fetch recent messages
      const { data: messages, error } = await supabase.rpc('get_conversation_messages_paginated', {
        p_conversation_id: conversationId,
        p_limit: 30,
        p_before: new Date().toISOString(),
      });

      if (error || !messages) return;

      // Save to SQLite
      await messageDb.saveMessages(messages, conversationId);

      // Preload media in background
      await preloadMediaForMessages(messages);
    } catch (error) {
      console.log('Preload conversation error:', error);
    }
  }, []);

  const preloadMediaForConversation = useCallback(async (conversationId: string) => {
    try {
      const messages = await messageDb.getMessages(conversationId, 20);
      await preloadMediaForMessages(messages as any);
    } catch (error) {
      console.log('Preload media error:', error);
    }
  }, []);

  const preloadMediaForMessages = useCallback(async (messages: any[]) => {
    const mediaUrls: Array<{ url: string; type: 'image' | 'video' | 'voice' }> = [];
    
    messages.forEach((msg) => {
      if (msg.type === 'image' && msg.metadata?.image_url) {
        mediaUrls.push({ url: msg.metadata.image_url, type: 'image' });
      } else if (msg.type === 'video' && msg.metadata?.video_url) {
        mediaUrls.push({ url: msg.metadata.video_url, type: 'video' });
      } else if ((msg.type === 'voice' || msg.metadata?.audio_url) && msg.metadata?.audio_url) {
        mediaUrls.push({ url: msg.metadata.audio_url, type: 'voice' });
      }
    });

    // Preload with lower priority (background)
    if (mediaUrls.length > 0) {
      // Limit to 10 media items to avoid overwhelming
      const toPreload = mediaUrls.slice(0, 10);
      
      for (const media of toPreload) {
        // Check if already cached
        const cached = await mediaCache.getCachedUri(media.url, media.type);
        if (cached === media.url) {
          // Not cached, download in background
          mediaCache.preload(media.url, media.type);
        }
      }
    }
  }, []);

  useEffect(() => {
    // Preload when app becomes active
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Wait a bit for app to settle, then preload
        setTimeout(() => {
          preloadConversations();
        }, 2000);
      }
    });

    // Initial preload
    const timer = setTimeout(() => {
      preloadConversations();
    }, 3000);

    return () => {
      subscription.remove();
      clearTimeout(timer);
    };
  }, [preloadConversations]);
}
