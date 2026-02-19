import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Play, Pause, Mic } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { mediaCache } from '../lib/mediaCache';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  SharedValue,
} from 'react-native-reanimated';

interface VoiceMessageProps {
  audioUrl: string;
  duration?: number; // in seconds
  isMe: boolean;
  time: string;
}

interface WaveformBarProps {
  height: number;
  index: number;
  totalBars: number;
  progressAnim: SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
  scale: number;
}

// Individual waveform bar with smooth animation
const WaveformBar = memo(({ height, index, totalBars, progressAnim, activeColor, inactiveColor, scale }: WaveformBarProps) => {
  const barStyle = useAnimatedStyle(() => {
    const barProgress = index / (totalBars - 1);
    const isActive = progressAnim.value >= barProgress;
    return {
      backgroundColor: isActive ? activeColor : inactiveColor,
    };
  });

  return (
    <Reanimated.View
      style={[
        {
          width: scale * 3,
          height: `${height}%`,
          borderRadius: scale * 1.5,
        },
        barStyle,
      ]}
    />
  );
});

WaveformBar.displayName = 'WaveformBar';

export default memo(function VoiceMessage({ audioUrl, duration: initialDuration, isMe, time }: VoiceMessageProps) {
  const { theme, isDark, scale } = useTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCaching, setIsCaching] = useState(true);
  const [durationMs, setDurationMs] = useState((initialDuration || 0) * 1000);
  const [cachedUri, setCachedUri] = useState<string>(audioUrl);
  const progressAnim = useSharedValue(0);
  const isMounted = useRef(true);

  const s = (size: number) => size * scale;
  
  // Memoized waveform heights - generate once and keep stable (0-100 values)
  const waveformHeights = useRef<number[]>(
    Array.from({ length: 20 }, (_, i) => {
      const base = 40;
      const variation = Math.sin(i * 0.9) * 25;
      const random = Math.random() * 20;
      return Math.max(15, Math.min(80, base + variation + random));
    })
  );
  
  // Validate audio URL
  if (!audioUrl) {
    return (
      <View style={{
        maxWidth: '75%',
        backgroundColor: isMe ? theme.primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
        borderRadius: s(24),
        paddingHorizontal: s(14),
        paddingVertical: s(12),
        marginHorizontal: s(8),
      }}>
        <Text style={{ color: isMe ? '#fff' : theme.text }}>Voice message unavailable</Text>
        <Text style={{ color: isMe ? 'rgba(255,255,255,0.6)' : theme.textMuted, fontSize: s(10), marginTop: s(4) }}>{time}</Text>
      </View>
    );
  }

  // Cache audio on mount
  useEffect(() => {
    const cacheAudio = async () => {
      // Check if already cached
      const existingCache = await mediaCache.getCachedUri(audioUrl, 'voice');
      if (existingCache !== audioUrl) {
        setCachedUri(existingCache);
        setIsCaching(false);
        return;
      }
      
      // Cache in background
      try {
        const localUri = await mediaCache.downloadAndCache(audioUrl, 'voice');
        if (isMounted.current) {
          setCachedUri(localUri);
        }
      } catch (error) {
        console.error('Voice caching error:', error);
      } finally {
        if (isMounted.current) {
          setIsCaching(false);
        }
      }
    };
    
    cacheAudio();
  }, [audioUrl]);

  // Load sound on mount (after caching starts)
  useEffect(() => {
    isMounted.current = true;
    if (!isCaching) {
      loadSound();
    }
    
    return () => {
      isMounted.current = false;
      // Use setImmediate to ensure cleanup happens on next tick
      if (Platform.OS === 'android') {
        setTimeout(() => {
          if (sound) {
            sound.unloadAsync().catch(() => {});
          }
        }, 0);
      } else {
        if (sound) {
          sound.unloadAsync().catch(() => {});
        }
      }
    };
  }, [cachedUri, isCaching]);

  const loadSound = async () => {
    try {
      setIsLoading(true);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: cachedUri },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      
      if (!isMounted.current) {
        // Component unmounted during load, clean up
        newSound.unloadAsync().catch(() => {});
        return;
      }
      
      setSound(newSound);
      
      // Get duration
      const status = await newSound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        setDurationMs(status.durationMillis);
      }
    } catch (error) {
      console.error('Failed to load sound:', error);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (!status.isLoaded || !isMounted.current) return;

    setIsPlaying(status.isPlaying);
    
    // Update progress animation smoothly using milliseconds
    if (status.durationMillis > 0) {
      const progress = status.positionMillis / status.durationMillis;
      progressAnim.value = progress;
    }

    if (status.didJustFinish && isMounted.current) {
      progressAnim.value = withTiming(0, { duration: 200 });
    }
  }, []);

  const togglePlayback = async () => {
    if (!sound || isLoading) return;

    try {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        // Reset if at end
        if (status.positionMillis >= (status.durationMillis || 0) - 100) {
          await sound.setPositionAsync(0);
          progressAnim.value = 0;
        }
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Failed to toggle playback:', error);
    }
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Animated style for smooth progress bar
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  // Calculate duration text from animated value
  const [remainingTime, setRemainingTime] = useState(formatTime(durationMs));
  
  useEffect(() => {
    // Update remaining time display based on progress
    const interval = setInterval(() => {
      const currentProgress = progressAnim.value;
      const remaining = durationMs * (1 - currentProgress);
      setRemainingTime(formatTime(remaining));
    }, 100);
    return () => clearInterval(interval);
  }, [durationMs]);

  // Colors for received messages should match the muted text color (like date pill)
  const playButtonBgColor = isMe ? 'rgba(255,255,255,0.2)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)');
  const playButtonIconColor = isMe ? '#fff' : theme.textMuted;
  const activeWaveColor = isMe ? '#fff' : theme.textMuted;
  const inactiveWaveColor = isMe ? 'rgba(255,255,255,0.3)' : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)');

  return (
    <View style={{
      width: '65%',
      backgroundColor: isMe ? theme.primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
      borderRadius: s(24),
      paddingHorizontal: s(14),
      paddingVertical: s(12),
      marginHorizontal: s(8),
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Play/Pause Button - Uses muted color for received messages */}
        <TouchableOpacity
          onPress={togglePlayback}
          disabled={isLoading || isCaching}
          style={{
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: playButtonBgColor,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: s(12),
          }}
        >
          {isLoading || isCaching ? (
            <ActivityIndicator size="small" color={playButtonIconColor} />
          ) : isPlaying ? (
            <Pause size={s(20)} color={playButtonIconColor} />
          ) : (
            <Play size={s(20)} color={playButtonIconColor} style={{ marginLeft: s(2) }} />
          )}
        </TouchableOpacity>

        {/* Waveform and Progress */}
        <View style={{ flex: 1 }}>
          {/* Waveform bars - Smooth animated */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            height: s(32), 
            marginBottom: s(6),
          }}>
            {waveformHeights.current.map((height, i) => (
              <WaveformBar
                key={i}
                height={height}
                index={i}
                totalBars={20}
                progressAnim={progressAnim}
                activeColor={activeWaveColor}
                inactiveColor={inactiveWaveColor}
                scale={scale}
              />
            ))}
          </View>

          {/* Progress bar */}
          <View style={{
            height: s(2),
            backgroundColor: isMe ? 'rgba(255,255,255,0.3)' : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
            borderRadius: s(1),
            overflow: 'hidden',
          }}>
            <Reanimated.View
              style={[
                {
                  height: '100%',
                  backgroundColor: activeWaveColor,
                  borderRadius: s(1),
                },
                progressStyle,
              ]}
            />
          </View>
        </View>

        {/* Duration */}
        <Text style={{
          color: isMe ? 'rgba(255,255,255,0.9)' : theme.textMuted,
          fontSize: s(12),
          fontWeight: '500',
          marginLeft: s(10),
          minWidth: s(38),
          textAlign: 'right',
        }}>
          {remainingTime}
        </Text>
      </View>

      {/* Time */}
      <Text style={{
        color: isMe ? 'rgba(255,255,255,0.6)' : theme.textMuted,
        fontSize: s(10),
        marginTop: s(4),
        textAlign: 'right',
      }}>
        {time}
      </Text>
    </View>
  );
});
