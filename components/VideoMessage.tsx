import { useState, useRef, useCallback, memo, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, Alert, Platform, Modal } from 'react-native';
import { Play, Pause, Download, X } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import { mediaCache } from '../lib/mediaCache';

interface VideoMessageProps {
  videoUrl: string;
  duration?: number; // in seconds
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
  const videoRef = useRef<Video>(null);
  const fullscreenVideoRef = useRef<Video>(null);
  const [status, setStatus] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenStatus, setFullscreenStatus] = useState<any>({});
  const [cachedUri, setCachedUri] = useState<string>(videoUrl);
  const [isCaching, setIsCaching] = useState(false);
  const isMounted = useRef(true);

  const s = (size: number) => size * scale;

  // Download and cache video on mount
  useEffect(() => {
    const cacheVideo = async () => {
      // Check if already cached
      const existingCache = await mediaCache.getCachedUri(videoUrl, 'video');
      if (existingCache !== videoUrl) {
        setCachedUri(existingCache);
        return;
      }
      
      // Start caching in background
      setIsCaching(true);
      try {
        const localUri = await mediaCache.downloadAndCache(videoUrl, 'video');
        if (isMounted.current) {
          setCachedUri(localUri);
        }
      } catch (error) {
        console.error('Video caching error:', error);
      } finally {
        if (isMounted.current) {
          setIsCaching(false);
        }
      }
    };
    
    cacheVideo();
  }, [videoUrl]);

  // Progress animation
  const progressAnim = useSharedValue(0);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Cleanup video on unmount
      if (Platform.OS === 'android') {
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.unloadAsync().catch(() => {});
          }
        }, 0);
      } else {
        if (videoRef.current) {
          videoRef.current.unloadAsync().catch(() => {});
        }
      }
    };
  }, []);

  useEffect(() => {
    if (status.durationMillis && status.positionMillis) {
      const progress = status.positionMillis / status.durationMillis;
      progressAnim.value = withTiming(progress, { duration: 250 });
    }
  }, [status.positionMillis, status.durationMillis]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (status.isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('Video play/pause error:', error);
    }
  }, [status.isPlaying]);

  const handleDownload = useCallback(async () => {
    try {
      // Use cached version if available
      const localUri = cachedUri !== videoUrl 
        ? cachedUri 
        : await mediaCache.downloadAndCache(videoUrl, 'video');
      
      const fileName = videoUrl.split('/').pop()?.split('?')[0] || `video_${Date.now()}.mp4`;
      const downloadUri = FileSystem.documentDirectory + fileName;
      
      // Copy to documents directory for user access
      await FileSystem.copyAsync({ from: localUri, to: downloadUri });
      
      Alert.alert('Download Complete', `Video saved to: ${fileName}`);
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', 'Could not download the video.');
    }
  }, [videoUrl, cachedUri]);

  const onPlaybackStatusUpdate = useCallback((newStatus: any) => {
    if (isMounted.current) {
      setStatus(newStatus);
    }
  }, []);

  const onFullscreenStatusUpdate = useCallback((newStatus: any) => {
    if (isMounted.current) {
      setFullscreenStatus(newStatus);
    }
  }, []);

  const handleFullscreenPlayPause = useCallback(async () => {
    if (!fullscreenVideoRef.current) return;

    try {
      if (fullscreenStatus.isPlaying) {
        await fullscreenVideoRef.current.pauseAsync();
      } else {
        await fullscreenVideoRef.current.playAsync();
      }
    } catch (error) {
      console.error('Fullscreen video play/pause error:', error);
    }
  }, [fullscreenStatus.isPlaying]);

  const openFullscreen = useCallback(async () => {
    setIsFullscreen(true);
    // Sync position with main video
    if (videoRef.current && fullscreenVideoRef.current && status.positionMillis) {
      await fullscreenVideoRef.current.setPositionAsync(status.positionMillis);
    }
  }, [status.positionMillis]);

  const closeFullscreen = useCallback(async () => {
    // Sync position back to main video
    if (videoRef.current && fullscreenVideoRef.current && fullscreenStatus.positionMillis) {
      await videoRef.current.setPositionAsync(fullscreenStatus.positionMillis);
    }
    setIsFullscreen(false);
  }, [fullscreenStatus.positionMillis]);

  const currentTime = status.positionMillis ? status.positionMillis / 1000 : 0;
  const totalDuration = status.durationMillis ? status.durationMillis / 1000 : (initialDuration || 0);

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
        <Video
          ref={videoRef}
          source={{ uri: cachedUri }}
          style={{
            width: '100%',
            height: '100%',
          }}
          resizeMode={ResizeMode.COVER}
          isLooping={false}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          onLoadStart={() => setIsLoading(true)}
          onLoad={() => setIsLoading(false)}
        />

        {/* Loading Indicator */}
        {(isLoading || isCaching) && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}>
            <ActivityIndicator color="#fff" size="large" />
            {isCaching && (
              <Text style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: s(12),
                marginTop: s(8),
              }}>
                Caching...
              </Text>
            )}
          </View>
        )}

        {/* Play/Pause Overlay */}
        {!status.isPlaying && !isLoading && !isCaching && (
          <TouchableOpacity
            onPress={handlePlayPause}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          >
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
          </TouchableOpacity>
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

        {/* Fullscreen Hint */}
        <View style={{
          position: 'absolute',
          bottom: s(8),
          left: s(8),
          backgroundColor: 'rgba(0,0,0,0.5)',
          paddingHorizontal: s(8),
          paddingVertical: s(4),
          borderRadius: s(6),
        }}>
          <Text style={{
            color: '#fff',
            fontSize: s(10),
            fontWeight: '500',
          }}>
            Tap to expand
          </Text>
        </View>
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
          {status.isPlaying ? (
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
            <Video
              ref={fullscreenVideoRef}
              source={{ uri: cachedUri }}
              style={{
                width: '100%',
                height: '100%',
              }}
              resizeMode={ResizeMode.CONTAIN}
              isLooping={false}
              onPlaybackStatusUpdate={onFullscreenStatusUpdate}
              shouldPlay={true}
            />

            {/* Play/Pause Overlay for Fullscreen */}
            {!fullscreenStatus.isPlaying && (
              <TouchableOpacity
                onPress={handleFullscreenPlayPause}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                }}
              >
                <View style={{
                  width: s(72),
                  height: s(72),
                  borderRadius: s(36),
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Play size={s(36)} color="#000" style={{ marginLeft: s(4) }} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Fullscreen Controls */}
          <View style={{
            position: 'absolute',
            bottom: s(60),
            left: s(20),
            right: s(20),
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: s(12),
            paddingHorizontal: s(16),
            paddingVertical: s(12),
          }}>
            <TouchableOpacity
              onPress={handleFullscreenPlayPause}
              style={{
                width: s(44),
                height: s(44),
                borderRadius: s(22),
                backgroundColor: 'rgba(255,255,255,0.2)',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: s(16),
              }}
            >
              {fullscreenStatus.isPlaying ? (
                <Pause size={s(22)} color="#fff" />
              ) : (
                <Play size={s(22)} color="#fff" style={{ marginLeft: s(2) }} />
              )}
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={{
                color: '#fff',
                fontSize: s(14),
                fontWeight: '500',
              }}>
                {formatTime((fullscreenStatus.positionMillis || 0) / 1000)} / {formatTime((fullscreenStatus.durationMillis || totalDuration * 1000) / 1000)}
              </Text>
            </View>
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
