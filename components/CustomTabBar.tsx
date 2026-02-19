import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { BlurView } from 'expo-blur';
import { Mail, Camera, UserCircle, SlidersHorizontal } from 'lucide-react-native';

interface TabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

const icons: Record<string, React.FC<{ size: number; color: string; strokeWidth: number }>> = {
  index: Mail,
  camera: Camera,
  contacts: UserCircle,
  settings: SlidersHorizontal,
};

const labels: Record<string, string> = {
  index: 'Chats',
  camera: 'Camera',
  contacts: 'People',
  settings: 'Settings',
};

export default function CustomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { theme, isDark, scale } = useTheme();
  const s = (size: number) => size * scale;

  return (
    <View style={{
      position: 'absolute',
      bottom: s(20),
      left: '10%',
      right: '10%',
      height: s(60),
      borderRadius: s(30),
      overflow: 'hidden',
    }}>
      {/* Background with blur */}
      <View style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius: s(30),
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      }}>
        <BlurView
          tint={isDark ? 'dark' : 'light'}
          intensity={60}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      {/* Tab items */}
      <View style={{
        flex: 1,
        flexDirection: 'row',
        padding: s(5),
      }}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          
          // Skip camera tab in tab bar (it's hidden)
          if (route.name === 'camera') return null;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const Icon = icons[route.name];
          const label = labels[route.name];

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: s(21),
                backgroundColor: isFocused ? theme.surface : 'transparent',
                shadowColor: isFocused ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isFocused ? 0.08 : 0,
                shadowRadius: 2,
                elevation: isFocused ? 1 : 0,
              }}
            >
              <Icon 
                size={s(22)} 
                color={isFocused ? theme.primary : theme.textMuted}
                strokeWidth={isFocused ? 2.5 : 2}
              />
              <Text style={{
                fontSize: s(10),
                fontWeight: isFocused ? '700' : '500',
                color: isFocused ? theme.primary : theme.textMuted,
                marginTop: s(2),
              }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
