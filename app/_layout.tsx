import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { useMemo } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SectionFilterProvider } from '../context/SectionFilterContext';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { mediaCache } from '../lib/mediaCache';

function RootLayoutNav() {
  const { theme, isDark } = useTheme();
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // Initialize media cache on app start
  useEffect(() => {
    mediaCache.init();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    
    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('../auth');
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated and trying to access auth
      router.replace('/(tabs)');
    }
    
    setIsReady(true);
  }, [user, loading, segments]);

  const containerStyle = useMemo(() => ({
    flex: 1,
    backgroundColor: theme.background,
    fontFamily: theme.fontFamily,
  }), [theme.background, theme.fontFamily]);

  if (loading || !isReady) {
    return (
      <Animated.View 
        entering={FadeIn.duration(200)}
        style={[containerStyle, { justifyContent: 'center', alignItems: 'center' }]}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      </Animated.View>
    );
  }

  return (
    <Animated.View 
      entering={FadeIn.duration(200)}
      style={containerStyle}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          animationDuration: 200,
          contentStyle: { backgroundColor: theme.background },
          presentation: 'card',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          freezeOnBlur: true,
          gestureResponseDistance: { start: 25, end: 50 },
        }}
      >
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            animation: 'none',
            contentStyle: { backgroundColor: theme.background },
          }} 
        />
        <Stack.Screen 
          name="chat/[id]" 
          options={{ 
            headerShown: false,
            animationDuration: 200,
            contentStyle: { backgroundColor: theme.background },
          }} 
        />
        <Stack.Screen 
          name="new-chat" 
          options={{ 
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
            animationDuration: 200,
            contentStyle: { backgroundColor: isDark ? '#0D0D14' : '#FFFFFF' },
          }} 
        />
        <Stack.Screen 
          name="auth/index" 
          options={{ 
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
          }} 
        />
        <Stack.Screen 
          name="profile" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: theme.background },
          }} 
        />
        <Stack.Screen 
          name="user/[id]" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: theme.background },
          }} 
        />

        <Stack.Screen 
          name="activity" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 200,
            contentStyle: { backgroundColor: theme.background },
          }} 
        />
        <Stack.Screen 
          name="group-settings/[id]" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 200,
            contentStyle: { backgroundColor: theme.background },
          }} 
        />
      </Stack>
    </Animated.View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0D0D14' }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#0D0D14' }}>
        <ThemeProvider>
          <AuthProvider>
            <SectionFilterProvider>
              <RootLayoutNav />
            </SectionFilterProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

