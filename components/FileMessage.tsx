import { useState, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { FileText, Download, Check } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import * as FileSystem from 'expo-file-system/legacy';

interface FileMessageProps {
  fileUrl: string;
  fileName: string;
  fileSize?: number; // in bytes
  isMe: boolean;
  time: string;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default memo(function FileMessage({ fileUrl, fileName, fileSize, isMe, time }: FileMessageProps) {
  const { theme, isDark, scale } = useTheme();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

  const s = (size: number) => size * scale;

  const handleDownload = useCallback(async () => {
    if (isDownloading || isDownloaded) return;

    try {
      setIsDownloading(true);
      
      // Create filename for local storage
      const localFileName = fileName || fileUrl.split('/').pop() || 'download';
      const localUri = FileSystem.documentDirectory + localFileName;

      // Download file
      const downloadResult = await FileSystem.downloadAsync(fileUrl, localUri);
      
      if (downloadResult.status === 200) {
        setIsDownloaded(true);
        Alert.alert('Download Complete', `File saved to: ${localFileName}`);
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', 'Could not download the file. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }, [fileUrl, fileName, isDownloading, isDownloaded]);

  const displayName = fileName || 'File';
  const displaySize = formatFileSize(fileSize);

  return (
    <View style={{
      maxWidth: '75%',
      backgroundColor: isMe ? theme.primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
      borderRadius: s(18),
      paddingHorizontal: s(14),
      paddingVertical: s(12),
      marginHorizontal: s(8),
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* File Icon */}
        <View style={{
          width: s(44),
          height: s(44),
          borderRadius: s(10),
          backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : theme.surfaceHighlight,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: s(12),
        }}>
          <FileText size={s(24)} color={isMe ? '#fff' : theme.primary} />
        </View>

        {/* File Info */}
        <View style={{ flex: 1, marginRight: s(8) }}>
          <Text 
            style={{
              color: isMe ? '#fff' : theme.text,
              fontSize: s(15),
              fontWeight: '600',
            }}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {displaySize && (
            <Text style={{
              color: isMe ? 'rgba(255,255,255,0.7)' : theme.textMuted,
              fontSize: s(12),
              marginTop: s(2),
            }}>
              {displaySize}
            </Text>
          )}
        </View>

        {/* Download Button */}
        <TouchableOpacity
          onPress={handleDownload}
          disabled={isDownloading || isDownloaded}
          style={{
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : theme.surfaceHighlight,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={isMe ? '#fff' : theme.primary} />
          ) : isDownloaded ? (
            <Check size={s(22)} color={isMe ? '#fff' : theme.primary} />
          ) : (
            <Download size={s(22)} color={isMe ? '#fff' : theme.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Time */}
      <Text style={{
        color: isMe ? 'rgba(255,255,255,0.6)' : theme.textMuted,
        fontSize: s(10),
        marginTop: s(8),
        textAlign: 'right',
      }}>
        {time}
      </Text>
    </View>
  );
});
