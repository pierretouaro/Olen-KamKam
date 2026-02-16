import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions, PanResponder } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const tabRoutes = ['index', 'contacts', 'settings'];

interface SwipeableScreenProps {
  children: React.ReactNode;
}

export default function SwipeableScreen({ children }: SwipeableScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes, not vertical scrolls
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 60;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        const swipeThreshold = SCREEN_WIDTH * 0.12;
        const velocityThreshold = 0.3;
        
        const currentRoute = pathname.split('/').pop() || 'index';
        const currentIndex = tabRoutes.indexOf(currentRoute);

        if ((dx > swipeThreshold || vx > velocityThreshold) && currentIndex > 0) {
          // Swipe right - go to previous tab
          const targetRoute = tabRoutes[currentIndex - 1];
          if (targetRoute === 'index') {
            router.push('/(tabs)' as any);
          } else {
            router.push(`/(tabs)/${targetRoute}` as any);
          }
        } else if ((dx < -swipeThreshold || vx < -velocityThreshold) && currentIndex < tabRoutes.length - 1) {
          // Swipe left - go to next tab
          const targetRoute = tabRoutes[currentIndex + 1];
          if (targetRoute === 'index') {
            router.push('/(tabs)' as any);
          } else {
            router.push(`/(tabs)/${targetRoute}` as any);
          }
        }
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
