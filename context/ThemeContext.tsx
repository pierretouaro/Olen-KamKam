import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type ThemeColor = 'periwinkle' | 'green';

export type Theme = {
  background: string;
  surface: string;
  surfaceHighlight: string;
  primary: string;
  primaryLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  incomingBubble: string;
  outgoingBubble: string;
  fontFamily: string;
  fontFamilyMedium: string;
  fontFamilyBold: string;
  isDark?: boolean;
};

// Periwinkle Themes
const periwinkleLight: Theme = {
  background: '#FFFFFF',
  surface: '#F8F9FF',
  surfaceHighlight: '#F0F2FF',
  primary: '#8B9EFF',
  primaryLight: '#E8EBFF',
  text: '#1E1B2E',
  textSecondary: '#4B5563',
  textMuted: '#8B909A',
  border: '#E8EBF0',
  incomingBubble: '#F8F9FF',
  outgoingBubble: '#8B9EFF',
  fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  fontFamilyMedium: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  fontFamilyBold: Platform.OS === 'ios' ? 'System' : 'sans-serif',
};

const periwinkleDark: Theme = {
  background: '#0D0D14',
  surface: 'rgba(26, 26, 46, 0.85)',
  surfaceHighlight: 'rgba(37, 37, 66, 0.9)',
  primary: '#8B9EFF',
  primaryLight: 'rgba(139, 158, 255, 0.2)',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: 'rgba(255, 255, 255, 0.1)',
  incomingBubble: '#2B2B45',
  outgoingBubble: '#8B5CF6',
  fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  fontFamilyMedium: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  fontFamilyBold: Platform.OS === 'ios' ? 'System' : 'sans-serif',
};

// Phthalo Green Themes
const greenLight: Theme = {
  background: '#FFFFFF',
  surface: '#F0F5F2',
  surfaceHighlight: '#E8F0EC',
  primary: '#1B4D3E',
  primaryLight: 'rgba(27, 77, 62, 0.15)',
  text: '#1E1B2E',
  textSecondary: '#4B5563',
  textMuted: '#6B7280',
  border: 'rgba(27, 77, 62, 0.15)',
  incomingBubble: '#F0F5F2',
  outgoingBubble: '#1B4D3E',
  fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  fontFamilyMedium: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  fontFamilyBold: Platform.OS === 'ios' ? 'System' : 'sans-serif',
};

const greenDark: Theme = {
  background: '#0A1612',
  surface: 'rgba(20, 50, 40, 0.7)',
  surfaceHighlight: 'rgba(30, 70, 55, 0.6)',
  primary: '#2D8A6F',
  primaryLight: 'rgba(45, 138, 111, 0.2)',
  text: '#F0F5F3',
  textSecondary: '#94B0A6',
  textMuted: '#6B8A7E',
  border: 'rgba(45, 138, 111, 0.2)',
  incomingBubble: '#14332A',
  outgoingBubble: '#2D8A6F',
  fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  fontFamilyMedium: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  fontFamilyBold: Platform.OS === 'ios' ? 'System' : 'sans-serif',
};

const themes = {
  periwinkle: {
    light: periwinkleLight,
    dark: periwinkleDark,
  },
  green: {
    light: greenLight,
    dark: greenDark,
  },
};

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  themeColor: ThemeColor;
  scale: number;
  toggleTheme: () => void;
  setThemeColor: (color: ThemeColor) => void;
  setScale: (scale: number) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: periwinkleLight,
  isDark: false,
  themeColor: 'periwinkle',
  scale: 1.0,
  toggleTheme: () => {},
  setThemeColor: () => {},
  setScale: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const [themeColor, setThemeColorState] = useState<ThemeColor>('periwinkle');
  const [scale, setScaleState] = useState(1.0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedDarkMode = await AsyncStorage.getItem('olen-dark-mode');
      const savedThemeColor = await AsyncStorage.getItem('olen-theme-color');
      const savedScale = await AsyncStorage.getItem('olen-scale');
      
      if (savedDarkMode !== null) {
        setIsDark(savedDarkMode === 'true');
      }
      if (savedThemeColor !== null && (savedThemeColor === 'periwinkle' || savedThemeColor === 'green')) {
        setThemeColorState(savedThemeColor);
      }
      if (savedScale !== null) {
        setScaleState(parseFloat(savedScale));
      }
      setLoaded(true);
    } catch (e) {
      setLoaded(true);
    }
  };

  const toggleTheme = async () => {
    const newDark = !isDark;
    setIsDark(newDark);
    try {
      await AsyncStorage.setItem('olen-dark-mode', newDark.toString());
    } catch (e) {
      console.error(e);
    }
  };

  const setThemeColor = async (color: ThemeColor) => {
    setThemeColorState(color);
    try {
      await AsyncStorage.setItem('olen-theme-color', color);
    } catch (e) {
      console.error(e);
    }
  };

  const setScale = async (newScale: number) => {
    setScaleState(newScale);
    try {
      await AsyncStorage.setItem('olen-scale', newScale.toString());
    } catch (e) {
      console.error(e);
    }
  };

  const theme = themes[themeColor][isDark ? 'dark' : 'light'];

  return (
    <ThemeContext.Provider value={{ theme, isDark, themeColor, scale, toggleTheme, setThemeColor, setScale }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
