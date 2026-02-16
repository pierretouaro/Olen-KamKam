import { Tabs } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Mail, Camera, UserCircle, SlidersHorizontal } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

export default function TabLayout() {
  const { theme, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: '12%',
          right: '12%',
          width: '80%',
          height: 60,
          borderRadius: 30,
          backgroundColor: theme.surface,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 8,
          paddingBottom: 0,
          paddingTop: 0,
          marginHorizontal: '10%',
        },
        tabBarBackground: () => (
          <View style={{
            ...StyleSheet.absoluteFillObject,
            borderRadius: 30,
            overflow: 'hidden',
            borderWidth: 0.4,
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
          }}>
            <BlurView
              tint={isDark ? 'dark' : 'light'}
              intensity={60}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        ),
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginBottom: 6,
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, focused }) => (
            <Mail 
              size={22} 
              color={color} 
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          tabBarLabel: 'Camera',
          tabBarIcon: ({ color, focused }) => (
            <Camera 
              size={22} 
              color={color} 
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          tabBarLabel: 'People',
          tabBarIcon: ({ color, focused }) => (
            <UserCircle 
              size={22} 
              color={color} 
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <SlidersHorizontal 
              size={22} 
              color={color} 
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
    </Tabs>
  );
}
