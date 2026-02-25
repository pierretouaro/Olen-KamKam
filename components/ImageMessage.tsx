import { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, Modal, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { X, Download } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import * as FileSystem from 'expo-file-system/legacy';
import { mediaCache } from '../lib/mediaCache';

interface ImageMessageProps {
  imageUrl: string;
  isMe: boolean;
  time: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default memo(function ImageMessage({ imageUrl, isMe, time }: ImageMessageProps) {
  const { theme, isDark, scale } = useTheme();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const s = (size: number) => size * scale;

  useEffect(() => {
    let isMounted = true;
    
    const loadImage = async () => {
      try {
        // 1. Check local cache first (fast, synchronous check)
        const cachedUri = await mediaCache.getCachedUri(imageUrl, 'image');
        
        if (cachedUri !== imageUrl) {
          // Cache hit: use local file immediately
          if (isMounted) {
            setLocalUri(cachedUri);
          }
        } else {
          // Cache miss: download once, then use local
          const downloadedUri = await mediaCache.downloadAndCache(imageUrl, 'image');
          if (isMounted && downloadedUri !== imageUrl) {
            setLocalUri(downloadedUri);
          } else if (isMounted) {
            // Download failed, show error
            setHasError(true);
          }
        }
      } catch (error) {
        console.error('Image load error:', error);
        if (isMounted) setHasError(true);
      }
    };
    
    loadImage();
    
    return () => {
      isMounted = false;
    };
  }, [imageUrl]); // Re-run if URL changes (FlashList recycling)

  const handleDownload = useCallback(async () => {
    if (!localUri) return;
    try {
      const fileName = imageUrl.split('/').pop()?.split('?')[0] || `image_${Date.now()}.jpg`;
      const downloadUri = FileSystem.documentDirectory + fileName;
      await FileSystem.copyAsync({ from: localUri, to: downloadUri });
    } catch (error) {
      console.error('Download error:', error);
    }
  }, [localUri, imageUrl]);

  // RENDER STATE 1: Loading (no network request triggered)
  if (!localUri && !hasError) {
    return (
      <View style={{
        width: s(200),
        height: s(200),
        backgroundColor: theme.surfaceHighlight,
        borderRadius: s(18),
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: s(8),
      }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  // RENDER STATE 2: Error
  if (hasError) {
    return (
      <View style={{
        width: s(200),
        height: s(200),
        backgroundColor: isMe ? theme.primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
        borderRadius: s(18),
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: s(8),
      }}>
        <Text style={{ color: isMe ? '#fff' : theme.text }}>Failed to load</Text>
      </View>
    );
  }

  // RENDER STATE 3: Success (ALWAYS use local file:// URI)
  return (
    <>
      <TouchableOpacity 
        onPress={() => setIsFullscreen(true)}
        activeOpacity={0.9}
        style={{ maxWidth: '65%', marginHorizontal: s(8) }}
      >
        <View style={{
          backgroundColor: isMe ? theme.primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
          borderRadius: s(18),
          padding: s(4),
          overflow: 'hidden',
        }}>
          <Image
            source={{ uri: localUri! }} // CRITICAL: Never imageUrl (remote)
            style={{
              width: s(200),
              height: s(200),
              borderRadius: s(14),
              backgroundColor: theme.surfaceHighlight,
            }}
            contentFit="cover"
            cachePolicy="memory" // Already on disk, just use memory cache
            transition={200}
          />
          
          {/* Time overlay */}
          <View style={{
            position: 'absolute',
            bottom: s(10),
            right: s(10),
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingHorizontal: s(8),
            paddingVertical: s(4),
            borderRadius: s(10),
          }}>
            <Text style={{ color: '#fff', fontSize: s(10), fontWeight: '500' }}>
              {time}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Fullscreen Modal */}
      <Modal
        visible={isFullscreen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.95)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {/* Close Button */}
          <TouchableOpacity
            onPress={() => setIsFullscreen(false)}
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

          {/* Fullscreen Image */}
          <Image
            source={{ uri: localUri! }} // CRITICAL: Always use local URI
            style={{
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT * 0.7,
            }}
            contentFit="contain"
            cachePolicy="memory"
            transition={200}
          />

          {/* Hint text */}
          <Text style={{
            position: 'absolute',
            bottom: s(40),
            color: 'rgba(255,255,255,0.6)',
            fontSize: s(14),
          }}>
            Tap X to close
          </Text>
        </View>
      </Modal>
    </>
  );
});
