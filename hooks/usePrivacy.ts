import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PrivacySettings {
  readReceipts: boolean;
  onlineStatus: boolean;
  typingIndicators: boolean;
  lastSeen: boolean;
}

export const usePrivacy = () => {
  const [settings, setSettings] = useState<PrivacySettings>({
    readReceipts: true,
    onlineStatus: true,
    typingIndicators: true,
    lastSeen: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('privacy_settings');
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load privacy settings', e);
    }
  };

  const updateSetting = useCallback(async (key: keyof PrivacySettings, value: boolean) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await AsyncStorage.setItem('privacy_settings', JSON.stringify(updated));
  }, [settings]);

  return { settings, updateSetting };
};