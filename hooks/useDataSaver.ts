import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useDataSaver = () => {
  const [dataSaverEnabled, setDataSaverEnabled] = useState(false);

  useEffect(() => {
    loadDataSaverSetting();
  }, []);

  const loadDataSaverSetting = async () => {
    try {
      const saved = await AsyncStorage.getItem('data_saver');
      if (saved !== null) {
        setDataSaverEnabled(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load data saver setting', e);
    }
  };

  const toggleDataSaver = useCallback(async () => {
    const newValue = !dataSaverEnabled;
    setDataSaverEnabled(newValue);
    await AsyncStorage.setItem('data_saver', JSON.stringify(newValue));
  }, [dataSaverEnabled]);

  return { dataSaverEnabled, toggleDataSaver };
};