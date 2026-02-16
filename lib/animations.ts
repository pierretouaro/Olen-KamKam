import { Easing } from 'react-native-reanimated';

// Telegram-like easing curves
export const telegramEasing = {
  // Smooth deceleration for entering elements
  easeOut: Easing.bezier(0.25, 0.46, 0.45, 0.94),
  // Smooth acceleration for leaving elements  
  easeIn: Easing.bezier(0.55, 0.085, 0.68, 0.53),
  // Smooth both ways for transitions
  easeInOut: Easing.bezier(0.455, 0.03, 0.515, 0.955),
  // Spring-like for bouncy effects
  spring: Easing.bezier(0.34, 1.56, 0.64, 1),
  // Quick snap for buttons
  snap: Easing.bezier(0.4, 0, 0.2, 1),
};

// Animation durations (matching Telegram's feel)
export const durations = {
  fast: 150,      // Button presses, small UI changes
  normal: 250,    // Page transitions, modals
  slow: 350,      // Complex animations
  spring: 400,    // Spring-based animations
};

// Shared transition configs
export const transitions = {
  // Slide from right (iOS style)
  slideFromRight: {
    animation: 'slide_from_right',
    animationDuration: 250,
  },
  // Slide from bottom (modals)
  slideFromBottom: {
    animation: 'slide_from_bottom',
    animationDuration: 300,
  },
  // Fade transition
  fade: {
    animation: 'fade',
    animationDuration: 200,
  },
  // None (instant)
  none: {
    animation: 'none',
  },
};

// List item animation config
export const listItemAnimation = {
  initial: { opacity: 0, translateY: 10 },
  animate: { opacity: 1, translateY: 0 },
  exit: { opacity: 0, translateY: -10 },
  transition: {
    duration: 200,
    easing: telegramEasing.easeOut,
  },
};

// Button press animation
export const buttonPressAnimation = {
  scale: {
    pressed: 0.96,
    normal: 1,
  },
  duration: 100,
};

// Message bubble animation
export const messageAnimation = {
  incoming: {
    initial: { opacity: 0, translateX: -20, scale: 0.95 },
    animate: { opacity: 1, translateX: 0, scale: 1 },
  },
  outgoing: {
    initial: { opacity: 0, translateX: 20, scale: 0.95 },
    animate: { opacity: 1, translateX: 0, scale: 1 },
  },
  transition: {
    duration: 250,
    easing: telegramEasing.spring,
  },
};

// Stagger animation for lists
export const staggerConfig = {
  stagger: 30,
  delayChildren: 50,
};
