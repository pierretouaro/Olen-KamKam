import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SectionFilterContextType {
  sectionFilterEnabled: boolean;
  toggleSectionFilter: () => void;
}

const SectionFilterContext = createContext<SectionFilterContextType>({
  sectionFilterEnabled: true,
  toggleSectionFilter: () => {},
});

export const SectionFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sectionFilterEnabled, setSectionFilterEnabled] = useState(true);

  useEffect(() => {
    loadSetting();
  }, []);

  const loadSetting = async () => {
    try {
      const saved = await AsyncStorage.getItem('section_filter_enabled');
      if (saved !== null) {
        setSectionFilterEnabled(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load section filter setting', e);
    }
  };

  const toggleSectionFilter = useCallback(async () => {
    const newValue = !sectionFilterEnabled;
    setSectionFilterEnabled(newValue);
    await AsyncStorage.setItem('section_filter_enabled', JSON.stringify(newValue));
  }, [sectionFilterEnabled]);

  return (
    <SectionFilterContext.Provider value={{ sectionFilterEnabled, toggleSectionFilter }}>
      {children}
    </SectionFilterContext.Provider>
  );
};

export const useSectionFilter = () => useContext(SectionFilterContext);
