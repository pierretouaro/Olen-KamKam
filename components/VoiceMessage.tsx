import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Play, Pause } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { mediaCache } from '../lib/mediaCache';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

interface VoiceMessageProps {
  audioUrl: string;
  duration?: number;
  isMe: boolean;
  time: string;
}

export default memo(function VoiceMessage({ audioUrl, duration: initialDuration, isMe, time }: VoiceMessageProps) {
  const { theme, isDark, scale } = useTheme();
  
  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, setIsCached] = useState(false);
  const [durationMs, setDurationMs] = useState((initialDuration || 0) * 1000);
  const [remainingTime, setRemainingTime] = useState(formatTime((initialDuration || 0) * 1000));
  const progressAnim = useSharedValue(0);
  const isMounted = useRef(true);
  const isReleased = useRef(false);
  const playerReadyRef = useRef(false);

  const s = (size: number) => size * scale;
  
  // Track mount/unmount state to prevent operations on released player
  useEffect(() => {
    isMounted.current = true;
    isReleased.current = false;
    
    return () => {
      isMounted.current = false;
      isReleased.current = true;
    };
  }, []);
  
  const isValidUrl = !!audioUrl;

  // Use expo-audio hook
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);

  // Set audio mode when player is ready
  useEffect(() => {
    const setupPlayer = async () => {
      if (!player || !isMounted.current) return;
      
      try {
        setIsLoading(true);
        
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false,
        });
        
        setTimeout(() => {
          if (status?.duration && isMounted.current) {
            setDurationMs(status.duration * 1000);
          }
          playerReadyRef.current = true;
          setIsLoading(false);
        }, 300);
        
      } catch {
        setIsLoading(false);
      }
    };
    
    setupPlayer();
  }, [player, status?.duration]);

  // Check cache
  useEffect(() => {
    const cacheAudio = async () => {
      try {
        const cachedUri = await mediaCache.getCachedUri(audioUrl, 'voice');
        if (cachedUri !== audioUrl && isMounted.current) {
          try {
            player.replace(cachedUri);
          } catch {
            // Ignore - player might be released
          }
        }
        
        const localUri = await mediaCache.downloadAndCache(audioUrl, 'voice');
        if (isMounted.current && localUri !== audioUrl) {
          setIsCached(true);
        }
      } catch {
        // Silently ignore cache errors
      }
    };
    
    cacheAudio();
  }, [audioUrl, player]);

  // Update play state and progress
  useEffect(() => {
    if (!status || !isMounted.current) return;
    
    setIsPlaying(status.playing);
    
    if (status.duration > 0) {
      const progress = status.currentTime / status.duration;
      progressAnim.value = progress;
    }
    
    if (!status.playing && status.currentTime >= status.duration - 0.1 && status.duration > 0) {
      progressAnim.value = withTiming(0, { duration: 200 });
      setIsPlaying(false);
    }
  }, [status, progressAnim]);

  // Update remaining time
  useEffect(() => {
    if (!status) return;
    const remaining = (status.duration - status.currentTime) * 1000;
    setRemainingTime(formatTime(Math.max(0, remaining)));
  }, [status, formatTime]);

  const togglePlayback = async () => {
    if (isLoading || !player || !playerReadyRef.current || isReleased.current) return;

    try {
      if (isPlaying) {
        player.pause();
      } else {
        if (status && status.currentTime >= (status.duration || 0) - 0.1) {
          player.seekTo(0);
          progressAnim.value = 0;
        }
        player.play();
      }
    } catch (error: any) {
      if (error?.message?.includes('released')) {
        setIsPlaying(false);
        isReleased.current = true;
      }
    }
  };

  // Animated style for progress bar
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  // Colors
  const playButtonBgColor = isMe ? 'rgba(255,255,255,0.2)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)');
  const playButtonIconColor = isMe ? '#fff' : theme.textMuted;
  const activeWaveColor = isMe ? '#fff' : theme.textMuted;
  const inactiveWaveColor = isMe ? 'rgba(255,255,255,0.3)' : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)');

  if (!isValidUrl) {
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
        {/* Play/Pause Button */}
        <TouchableOpacity
          onPress={togglePlayback}
          disabled={isLoading}
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
          {isLoading ? (
            <ActivityIndicator size="small" color={playButtonIconColor} />
          ) : isPlaying ? (
            <Pause size={s(20)} color={playButtonIconColor} />
          ) : (
            <Play size={s(20)} color={playButtonIconColor} style={{ marginLeft: s(2) }} />
          )}
        </TouchableOpacity>

        {/* Simplified Waveform - Static line with single animated progress */}
        <View style={{ flex: 1 }}>
          {/* Static waveform visualization */}
          <View style={{ 
            height: s(32), 
            marginBottom: s(6),
            justifyContent: 'center',
          }}>
            {/* Background track */}
            <View style={{
              height: s(2),
              backgroundColor: inactiveWaveColor,
              borderRadius: s(1),
            }} />
            
            {/* Animated progress fill */}
            <Reanimated.View
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  height: s(2),
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
          {isPlaying ? remainingTime : formatTime(durationMs)}
        </Text>
      </View>

      {/* Time label */}
      <Text style={{
        color: isMe ? 'rgba(255,255,255,0.6)' : theme.textMuted,
        fontSize: s(10),
        marginTop: s(4),
        marginLeft: s(52),
      }}>
        {time}
      </Text>
    </View>
  );
});
