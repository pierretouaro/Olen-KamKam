import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useDraftMessages = () => {
  const saveDraft = useCallback(async (chatId: string, text: string) => {
    try {
      await AsyncStorage.setItem(`draft_${chatId}`, text);
    } catch (e) {
      console.error('Failed to save draft', e);
    }
  }, []);

  const getDraft = useCallback(async (chatId: string) => {
    try {
      return await AsyncStorage.getItem(`draft_${chatId}`);
    } catch (e) {
      console.error('Failed to get draft', e);
      return null;
    }
  }, []);

  const clearDraft = useCallback(async (chatId: string) => {
    try {
      await AsyncStorage.removeItem(`draft_${chatId}`);
    } catch (e) {
      console.error('Failed to clear draft', e);
    }
  }, []);

  return { saveDraft, getDraft, clearDraft };
};