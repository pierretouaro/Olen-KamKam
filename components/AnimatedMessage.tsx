import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { telegramEasing } from '../lib/animations';

interface AnimatedMessageProps {
  children: React.ReactNode;
  isMe: boolean;
  style?: ViewStyle;
  onLongPress?: () => void;
}

const AnimatedMessage = ({
  children,
  isMe,
  style,
  onLongPress,
}: AnimatedMessageProps) => {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(isMe ? 20 : -20);
  const scale = useSharedValue(0.95);
  const pressed = useSharedValue(0);

  useEffect(() => {
    // Animate in
    opacity.value = withSpring(1, { damping: 20, stiffness: 300 });
    translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  const handlePressIn = () => {
    pressed.value = withTiming(1, { duration: 100 });
  };

  const handlePressOut = () => {
    pressed.value = withTiming(0, { duration: 150 });
  };

  const pressAnimatedStyle = useAnimatedStyle(() => {
    const scaleValue = interpolate(
      pressed.value,
      [0, 1],
      [1, 0.98]
    );
    return {
      transform: [{ scale: scaleValue }],
    };
  });

  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[style, animatedStyle, pressAnimatedStyle]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

export default AnimatedMessage;
