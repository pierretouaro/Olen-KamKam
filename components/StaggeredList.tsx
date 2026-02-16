import React from 'react';
import { View, FlatList, FlatListProps, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { telegramEasing } from '../lib/animations';

interface StaggeredListProps<T> extends Omit<FlatListProps<T>, 'renderItem'> {
  data: T[];
  renderItem: (info: { item: T; index: number }) => React.ReactNode;
  staggerDelay?: number;
  initialDelay?: number;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

const AnimatedItem = ({
  children,
  index,
  staggerDelay,
  initialDelay,
}: {
  children: React.ReactNode;
  index: number;
  staggerDelay: number;
  initialDelay: number;
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  React.useEffect(() => {
    const delay = initialDelay + index * staggerDelay;
    const timeout = setTimeout(() => {
      opacity.value = withTiming(1, {
        duration: 250,
        easing: telegramEasing.easeOut,
      });
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      });
    }, delay);

    return () => clearTimeout(timeout);
  }, [index, staggerDelay, initialDelay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
};

function StaggeredList<T>({
  data,
  renderItem,
  staggerDelay = 30,
  initialDelay = 100,
  style,
  contentContainerStyle,
  ...props
}: StaggeredListProps<T>) {
  return (
    <FlatList
      data={data}
      style={style}
      contentContainerStyle={contentContainerStyle}
      renderItem={({ item, index }) => (
        <AnimatedItem
          index={index}
          staggerDelay={staggerDelay}
          initialDelay={initialDelay}
        >
          {renderItem({ item, index })}
        </AnimatedItem>
      )}
      {...props}
    />
  );
}

export default StaggeredList;
