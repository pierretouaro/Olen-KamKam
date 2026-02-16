import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { telegramEasing, durations } from '../lib/animations';

interface FadeInViewProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  delay?: number;
  duration?: number;
  translateY?: number;
  translateX?: number;
  scale?: number;
  spring?: boolean;
}

const FadeInView = ({
  children,
  style,
  delay = 0,
  duration = durations.normal,
  translateY = 0,
  translateX = 0,
  scale = 1,
  spring = false,
}: FadeInViewProps) => {
  const opacity = useSharedValue(0);
  const translateYValue = useSharedValue(translateY > 0 ? 20 : translateY);
  const translateXValue = useSharedValue(translateX);
  const scaleValue = useSharedValue(scale < 1 ? 0.95 : 1);

  useEffect(() => {
    const animate = () => {
      if (spring) {
        opacity.value = withSpring(1, { damping: 20, stiffness: 300 });
        translateYValue.value = withSpring(0, { damping: 20, stiffness: 300 });
        translateXValue.value = withSpring(0, { damping: 20, stiffness: 300 });
        scaleValue.value = withSpring(1, { damping: 20, stiffness: 300 });
      } else {
        const config = {
          duration,
          easing: telegramEasing.easeOut,
        };
        opacity.value = withTiming(1, config);
        translateYValue.value = withTiming(0, config);
        translateXValue.value = withTiming(0, config);
        scaleValue.value = withTiming(1, config);
      }
    };

    const timeout = setTimeout(animate, delay);
    return () => clearTimeout(timeout);
  }, [delay, duration, spring]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateYValue.value },
      { translateX: translateXValue.value },
      { scale: scaleValue.value },
    ],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

export default FadeInView;
