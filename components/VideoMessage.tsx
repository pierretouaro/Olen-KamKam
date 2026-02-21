import { useState, useRef, useCallback, memo, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, Alert, Modal } from 'react-native';
import { Play, Pause, Download, X } from 'lucide-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image } from 'expo-image';
import { useTheme } from '../context/ThemeContext';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import { mediaCache } from '../lib/mediaCache';

interface VideoMessageProps {
  videoUrl: string;
  duration?: number;
  thumbnailUrl?: string;
  isMe: boolean;
  time: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default memo(function VideoMessage({ videoUrl, duration: initialDuration, thumbnailUrl, isMe, time }: VideoMessageProps) {
  const { theme, isDark, scale } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cachedUri, setCachedUri] = useState<string>(videoUrl);
  const [isCached, setIsCached] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(initialDuration || 0);
  const isMounted = useRef(true);
  const isReleased = useRef(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const s = (size: number) => size * scale;
  
  // Track mount/unmount state to prevent operations on released player
  useEffect(() => {
    isMounted.current = true;
    isReleased.current = false;
    
    return () => {
      isMounted.current = false;
      isReleased.current = true;
      
      // Delay cleanup to prevent race conditions
      setTimeout(() => {
        try {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
        } catch {
          // Ignore cleanup errors
        }
      }, 50);
    };
  }, []);

  // Create video player for inline video (start with original URL)
  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = false;
    player.timeUpdateEventInterval = 0.25;
  });

  // Create video player for fullscreen
  const fullscreenPlayer = useVideoPlayer(videoUrl, (player) => {
    player.loop = false;
    player.timeUpdateEventInterval = 0.25;
  });

  // Check cache on mount and switch to cached URI when available
  useEffect(() => {
    const checkCache = async () => {
      // First check if already cached
      const existingCache = await mediaCache.getCachedUri(videoUrl, 'video');
      if (existingCache !== videoUrl) {
        setCachedUri(existingCache);
        setIsCached(true);
        // Replace player source with cached version for smoother playback
        // Silently ignore errors - player might be released during unmount
        player.replaceAsync(existingCache).catch(() => {});
      }
      
      // Start background caching for future loads
      mediaCache.downloadAndCache(videoUrl, 'video').then((localUri) => {
        if (isMounted.current && localUri !== videoUrl && localUri !== cachedUri) {
          setCachedUri(localUri);
          setIsCached(true);
        }
      }).catch(() => {});
    };
    
    checkCache();
  }, [videoUrl, player, cachedUri]);

  // Progress animation
  const progressAnim = useSharedValue(0);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (totalDuration > 0) {
      const progress = currentTime / totalDuration;
      progressAnim.value = withTiming(progress, { duration: 250 });
    }
  }, [currentTime, totalDuration]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  // Listen to player status changes
  useEffect(() => {
    const subscription = player.addListener('statusChange', (payload) => {
      if (!isMounted.current) return;
      
      if (payload.status === 'readyToPlay') {
        setTotalDuration(player.duration / 1000);
        setIsLoading(false);
      }
    });

    const timeSubscription = player.addListener('timeUpdate', (event) => {
      if (!isMounted.current) return;
      setCurrentTime(event.currentTime / 1000);
    });

    const playSubscription = player.addListener('playingChange', (event) => {
      if (!isMounted.current) return;
      setIsPlaying(event.isPlaying);
    });

    return () => {
      subscription.remove();
      timeSubscription.remove();
      playSubscription.remove();
    };
  }, [player]);

  const handlePlayPause = useCallback(async () => {
    if (isReleased.current) return;
    
    try {
      if (isPlaying) {
        player.pause();
      } else {
        setHasStarted(true);
        player.play();
      }
    } catch (error: any) {
      // Ignore released player errors
      if (error?.message?.includes('released')) {
        setIsPlaying(false);
        isReleased.current = true;
      }
    }
  }, [isPlaying, player]);

  const handleDownload = useCallback(async () => {
    try {
      const localUri = cachedUri !== videoUrl ? cachedUri : await mediaCache.downloadAndCache(videoUrl, 'video');
      const fileName = videoUrl.split('/').pop()?.split('?')[0] || `video_${Date.now()}.mp4`;
      const downloadUri = FileSystem.documentDirectory + fileName;
      await FileSystem.copyAsync({ from: localUri, to: downloadUri });
      Alert.alert('Download Complete', `Video saved to: ${fileName}`);
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', 'Could not download the video.');
    }
  }, [videoUrl, cachedUri]);

  const openFullscreen = useCallback(async () => {
    if (isReleased.current) return;
    
    setIsFullscreen(true);
    
    // Sync position with fullscreen player
    if (hasStarted) {
      try {
        fullscreenPlayer.seekBy(player.currentTime - fullscreenPlayer.currentTime);
        fullscreenPlayer.play();
      } catch {
        // Ignore errors from released players
      }
    } else {
      setHasStarted(true);
      player.play();
    }
  }, [hasStarted, player, fullscreenPlayer]);

  const closeFullscreen = useCallback(async () => {
    if (isReleased.current) return;
    
    // Sync position back to inline player
    if (isFullscreen) {
      try {
        player.seekBy(fullscreenPlayer.currentTime - player.currentTime);
        if (fullscreenPlayer.playing) {
          player.play();
        } else {
          player.pause();
        }
      } catch {
        // Ignore errors from released players
      }
    }
    setIsFullscreen(false);
    fullscreenPlayer.pause();
  }, [isFullscreen, player, fullscreenPlayer]);

  // Fullscreen player listeners
  useEffect(() => {
    if (!isFullscreen) return;

    const subscription = fullscreenPlayer.addListener('statusChange', (status) => {
      if (!isMounted.current) return;
      // Handle fullscreen status changes if needed
    });

    return () => {
      subscription.remove();
    };
  }, [isFullscreen, fullscreenPlayer]);

  return (
    <View style={{
      width: '75%',
      backgroundColor: isMe ? theme.primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
      borderRadius: s(18),
      padding: s(4),
      marginHorizontal: s(8),
      overflow: 'hidden',
    }}>
      {/* Video Player */}
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={openFullscreen}
        style={{
          width: '100%',
          height: s(180),
          borderRadius: s(14),
          overflow: 'hidden',
          backgroundColor: '#000',
        }}
      >
        {/* Show thumbnail/poster when not playing */}
        {!hasStarted ? (
          <View style={{ width: '100%', height: '100%', backgroundColor: '#000' }}>
            {thumbnailUrl ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                cachePolicy="disk"
              />
            ) : (
              <View style={{ 
                width: '100%', 
                height: '100%', 
                backgroundColor: isDark ? '#1a1a1a' : '#333',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <Play size={s(48)} color="rgba(255,255,255,0.5)" />
              </View>
            )}
            
            {/* Play button overlay */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <View style={{
                width: s(56),
                height: s(56),
                borderRadius: s(28),
                backgroundColor: 'rgba(255,255,255,0.9)',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Play size={s(28)} color="#000" style={{ marginLeft: s(4) }} />
              </View>
            </View>
          </View>
        ) : (
          <VideoView
            player={player}
            style={{
              width: '100%',
              height: '100%',
            }}
            contentFit="cover"
            nativeControls={false}
          />
        )}

        {/* Loading Indicator */}
        {isLoading && hasStarted && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}

        {/* Duration Badge */}
        <View style={{
          position: 'absolute',
          top: s(8),
          right: s(8),
          backgroundColor: 'rgba(0,0,0,0.7)',
          paddingHorizontal: s(8),
          paddingVertical: s(4),
          borderRadius: s(6),
        }}>
          <Text style={{
            color: '#fff',
            fontSize: s(12),
            fontWeight: '600',
          }}>
            {formatTime(totalDuration)}
          </Text>
        </View>

        {/* Download Button */}
        <TouchableOpacity
          onPress={handleDownload}
          style={{
            position: 'absolute',
            top: s(8),
            left: s(8),
            width: s(36),
            height: s(36),
            borderRadius: s(18),
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Download size={s(18)} color="#fff" />
        </TouchableOpacity>

        {/* Cached indicator */}
        {isCached && (
          <View style={{
            position: 'absolute',
            bottom: s(8),
            left: s(8),
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingHorizontal: s(6),
            paddingVertical: s(2),
            borderRadius: s(4),
          }}>
            <Text style={{
              color: '#fff',
              fontSize: s(10),
            }}>
              Cached
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Controls Bar */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: s(10),
        paddingVertical: s(8),
      }}>
        {/* Play/Pause Button */}
        <TouchableOpacity
          onPress={handlePlayPause}
          style={{
            width: s(36),
            height: s(36),
            borderRadius: s(18),
            backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : theme.surfaceHighlight,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: s(10),
          }}
        >
          {isPlaying ? (
            <Pause size={s(18)} color={isMe ? '#fff' : theme.primary} />
          ) : (
            <Play size={s(18)} color={isMe ? '#fff' : theme.primary} style={{ marginLeft: s(2) }} />
          )}
        </TouchableOpacity>

        {/* Progress Bar */}
        <View style={{ flex: 1, marginRight: s(10) }}>
          <View style={{
            height: s(4),
            backgroundColor: isMe ? 'rgba(255,255,255,0.3)' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
            borderRadius: s(2),
            overflow: 'hidden',
          }}>
            <Reanimated.View
              style={[
                {
                  height: '100%',
                  backgroundColor: isMe ? '#fff' : theme.primary,
                  borderRadius: s(2),
                },
                progressStyle,
              ]}
            />
          </View>
          
          {/* Time Display */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: s(4),
          }}>
            <Text style={{
              color: isMe ? 'rgba(255,255,255,0.8)' : theme.textMuted,
              fontSize: s(11),
            }}>
              {formatTime(currentTime)}
            </Text>
            <Text style={{
              color: isMe ? 'rgba(255,255,255,0.8)' : theme.textMuted,
              fontSize: s(11),
            }}>
              {time}
            </Text>
          </View>
        </View>
      </View>

      {/* Fullscreen Modal */}
      <Modal
        visible={isFullscreen}
        transparent={true}
        animationType="fade"
        onRequestClose={closeFullscreen}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.95)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {/* Close Button */}
          <TouchableOpacity
            onPress={closeFullscreen}
            style={{
              position: 'absolute',
              top: s(50),
              right: s(20),
              zIndex: 10,
              width: s(44),
              height: s(44),
              borderRadius: s(22),
              backgroundColor: 'rgba(255,255,255,0.2)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <X size={s(24)} color="#fff" />
          </TouchableOpacity>

          {/* Download Button */}
          <TouchableOpacity
            onPress={handleDownload}
            style={{
              position: 'absolute',
              top: s(50),
              left: s(20),
              zIndex: 10,
              width: s(44),
              height: s(44),
              borderRadius: s(22),
              backgroundColor: 'rgba(255,255,255,0.2)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Download size={s(24)} color="#fff" />
          </TouchableOpacity>

          {/* Fullscreen Video */}
          <View style={{
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT * 0.6,
            backgroundColor: '#000',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <VideoView
              player={fullscreenPlayer}
              style={{
                width: '100%',
                height: '100%',
              }}
              contentFit="contain"
              nativeControls={true}
            />
          </View>

          {/* Hint text */}
          <Text style={{
            position: 'absolute',
            bottom: s(20),
            color: 'rgba(255,255,255,0.6)',
            fontSize: s(14),
          }}>
            Tap X to close
          </Text>
        </View>
      </Modal>
    </View>
  );
});
