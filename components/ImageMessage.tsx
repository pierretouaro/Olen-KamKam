import { useState, useCallback, memo } from 'react';
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

// Default blurhash for image placeholder (light gray)
const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

export default memo(function ImageMessage({ imageUrl, isMe, time }: ImageMessageProps) {
  const { theme, isDark, scale } = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const s = (size: number) => size * scale;

  const handleDownload = useCallback(async () => {
    try {
      const localUri = await mediaCache.downloadAndCache(imageUrl, 'image');
      const fileName = imageUrl.split('/').pop()?.split('?')[0] || `image_${Date.now()}.jpg`;
      const downloadUri = FileSystem.documentDirectory + fileName;
      await FileSystem.copyAsync({ from: localUri, to: downloadUri });
    } catch (error) {
      console.error('Download error:', error);
    }
  }, [imageUrl]);

  if (hasError) {
    return (
      <View style={{
        maxWidth: '65%',
        backgroundColor: isMe ? theme.primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
        borderRadius: s(18),
        padding: s(12),
        marginHorizontal: s(8),
      }}>
        <Text style={{ color: isMe ? '#fff' : theme.text }}>Image failed to load</Text>
        <Text style={{ color: isMe ? 'rgba(255,255,255,0.6)' : theme.textMuted, fontSize: s(10), marginTop: s(4) }}>
          {time}
        </Text>
      </View>
    );
  }

  return (
    <>
      {/* Thumbnail */}
      <TouchableOpacity 
        onPress={() => setIsFullscreen(true)}
        activeOpacity={0.9}
        style={{
          maxWidth: '65%',
          marginHorizontal: s(8),
        }}
      >
        <View style={{
          backgroundColor: isMe ? theme.primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
          borderRadius: s(18),
          padding: s(4),
          overflow: 'hidden',
        }}>
          <Image
            source={{ uri: imageUrl }}
            style={{
              width: s(200),
              height: s(200),
              borderRadius: s(14),
              backgroundColor: theme.surfaceHighlight,
            }}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
            priority="high"
            placeholder={DEFAULT_BLURHASH}
            placeholderContentFit="cover"
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
          
          {isLoading && (
            <View style={{
              position: 'absolute',
              top: s(4),
              left: s(4),
              right: s(4),
              bottom: s(4),
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: theme.surfaceHighlight,
              borderRadius: s(14),
            }}>
              <ActivityIndicator color={theme.primary} />
            </View>
          )}

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
            <Text style={{
              color: '#fff',
              fontSize: s(10),
              fontWeight: '500',
            }}>
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
            source={{ uri: imageUrl }}
            style={{
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT * 0.7,
            }}
            contentFit="contain"
            cachePolicy="disk"
            priority="high"
            transition={300}
            placeholder={DEFAULT_BLURHASH}
            placeholderContentFit="contain"
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
