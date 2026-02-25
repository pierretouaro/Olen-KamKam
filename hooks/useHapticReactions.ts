import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Utility function for delays - defined at top to avoid ReferenceError
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export type HapticPattern = 'heartbeat' | 'rapid' | 'pulse' | 'wave' | 'sharp' | 'gentle';

interface HapticPatternConfig {
  name: string;
  icon: string;
  description: string;
  color: string;
}

export const HAPTIC_PATTERNS: Record<HapticPattern, HapticPatternConfig> = {
  heartbeat: {
    name: 'Heartbeat',
    icon: 'Heart',
    description: 'Thump-thump... thump-thump',
    color: '#EF4444',
  },
  rapid: {
    name: 'Excited',
    icon: 'Zap',
    description: 'Quick rapid taps',
    color: '#F59E0B',
  },
  pulse: {
    name: 'Pulse',
    icon: 'Activity',
    description: 'Slow, calming pulse',
    color: '#8B5CF6',
  },
  wave: {
    name: 'Wave',
    icon: 'MoveRight',
    description: 'Flowing wave pattern',
    color: '#3B82F6',
  },
  sharp: {
    name: 'Alert',
    icon: 'Bell',
    description: 'Sharp attention grab',
    color: '#EC4899',
  },
  gentle: {
    name: 'Gentle',
    icon: 'Sparkles',
    description: 'Soft, soothing taps',
    color: '#10B981',
  },
};

export const useHapticReactions = () => {
  const playPattern = useCallback(async (pattern: HapticPattern) => {
    if (Platform.OS === 'web') return;

    try {
      switch (pattern) {
        case 'heartbeat':
          // Thump-thump pause thump-thump
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await sleep(150);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await sleep(400);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await sleep(150);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;

        case 'rapid':
          // Quick rapid taps - 5 fast taps
          for (let i = 0; i < 5; i++) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await sleep(60);
          }
          break;

        case 'pulse':
          // Slow pulse - 3 medium pulses
          for (let i = 0; i < 3; i++) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await sleep(400);
          }
          break;

        case 'wave':
          // Flowing wave - light to heavy
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await sleep(100);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await sleep(100);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await sleep(100);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await sleep(100);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;

        case 'sharp':
          // Sharp alert - 2 strong pulses
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          await sleep(200);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await sleep(100);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;

        case 'gentle':
          // Gentle taps - 4 soft taps
          for (let i = 0; i < 4; i++) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await sleep(200);
          }
          break;
      }
    } catch (e) {
      console.log('Haptics not available');
    }
  }, []);

  const sendHapticReaction = useCallback(async (conversationId: string, pattern: HapticPattern, supabase: any, userId: string) => {
    try {
      // Store as a special message type using the send_message function
      const { data, error } = await supabase.rpc('send_message', {
        p_conversation_id: conversationId,
        p_content: JSON.stringify({ type: 'haptic', pattern }),
        p_type: 'haptic',
        p_metadata: {},
        p_reply_to: null
      });

      if (error) throw error;
      
      // Play the pattern locally for feedback
      await playPattern(pattern);
      
      return true;
    } catch (error) {
      console.error('Error sending haptic reaction:', error);
      return false;
    }
  }, [playPattern]);

  return {
    playPattern,
    sendHapticReaction,
    patterns: HAPTIC_PATTERNS,
  };
};
