import React, { useEffect, memo } from 'react';
import { View, Text } from 'react-native';
import { Heart, Zap, Activity, MoveRight, Bell, Sparkles } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useHapticReactions, HapticPattern, HAPTIC_PATTERNS } from '../hooks/useHapticReactions';

const ICON_MAP = {
  Heart,
  Zap,
  Activity,
  MoveRight,
  Bell,
  Sparkles,
};

interface HapticMessageProps {
  pattern: HapticPattern;
  isMe: boolean;
  time: string;
  isLastInGroup: boolean;
  shouldPlay?: boolean;
}

export default memo(function HapticMessage({ 
  pattern, 
  isMe, 
  time, 
  isLastInGroup,
  shouldPlay = true 
}: HapticMessageProps) {
  const { theme, scale } = useTheme();
  const { playPattern, patterns } = useHapticReactions();
  const s = (size: number) => size * scale;

  const config = patterns[pattern] || HAPTIC_PATTERNS.heartbeat;
  const IconComponent = ICON_MAP[config.icon as keyof typeof ICON_MAP] || Heart;

  // Play the haptic when the message renders (if it's from someone else)
  useEffect(() => {
    if (shouldPlay && !isMe) {
      const timeout = setTimeout(() => {
        playPattern(pattern);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [pattern, isMe, shouldPlay, playPattern]);

  return (
    <View
      style={{
        maxWidth: '75%',
        backgroundColor: isMe ? `${config.color}18` : theme.surface,
        borderRadius: s(18),
        paddingHorizontal: s(16),
        paddingVertical: s(12),
        borderWidth: 1,
        borderColor: isMe ? `${config.color}35` : theme.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(12),
      }}
    >
      <View
        style={{
          width: s(42),
          height: s(42),
          borderRadius: s(21),
          backgroundColor: `${config.color}12`,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <IconComponent size={s(20)} color={config.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: theme.text,
            fontSize: s(15),
            fontWeight: '700',
          }}
        >
          {config.name}
        </Text>
        <Text
          style={{
            color: theme.textMuted,
            fontSize: s(12),
            marginTop: s(2),
          }}
        >
          {isMe ? 'You sent a vibe' : 'Sent you a vibe'}
        </Text>
      </View>
      <Text
        style={{
          color: isMe ? config.color : theme.textMuted,
          fontSize: s(11),
          fontWeight: '500',
        }}
      >
        {time}
      </Text>
    </View>
  );
});
