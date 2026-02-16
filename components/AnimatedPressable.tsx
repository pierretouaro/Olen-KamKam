import React from 'react';
import { Pressable, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { telegramEasing, durations } from '../lib/animations';

interface AnimatedPressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  disabled?: boolean;
  activeScale?: number;
  activeOpacity?: number;
}

const AnimatedPressable = ({
  children,
  onPress,
  onLongPress,
  style,
  disabled = false,
  activeScale = 0.96,
  activeOpacity = 0.9,
}: AnimatedPressableProps) => {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      pressed.value,
      [0, 1],
      [1, activeScale]
    );
    const opacity = interpolate(
      pressed.value,
      [0, 1],
      [1, activeOpacity]
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const handlePressIn = () => {
    pressed.value = withTiming(1, {
      duration: 100,
      easing: telegramEasing.snap,
    });
  };

  const handlePressOut = () => {
    pressed.value = withSpring(0, {
      damping: 15,
      stiffness: 400,
    });
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default AnimatedPressable;
