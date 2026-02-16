import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PinnedMessage {
  id: string;
  text: string;
  sender: string;
  time: string;
}

export const usePinnedMessages = (chatId: string) => {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);

  useEffect(() => {
    loadPinnedMessages();
  }, [chatId]);

  const loadPinnedMessages = async () => {
    try {
      const saved = await AsyncStorage.getItem(`pinned_${chatId}`);
      if (saved) {
        setPinnedMessages(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load pinned messages', e);
    }
  };

  const savePinnedMessages = async (messages: PinnedMessage[]) => {
    try {
      await AsyncStorage.setItem(`pinned_${chatId}`, JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save pinned messages', e);
    }
  };

  const pinMessage = useCallback(async (message: PinnedMessage) => {
    const updated = [...pinnedMessages, message];
    setPinnedMessages(updated);
    await savePinnedMessages(updated);
  }, [pinnedMessages]);

  const unpinMessage = useCallback(async (messageId: string) => {
    const updated = pinnedMessages.filter(m => m.id !== messageId);
    setPinnedMessages(updated);
    await savePinnedMessages(updated);
  }, [pinnedMessages]);

  const isPinned = useCallback((messageId: string) => {
    return pinnedMessages.some(m => m.id === messageId);
  }, [pinnedMessages]);

  return { pinnedMessages, pinMessage, unpinMessage, isPinned };
};