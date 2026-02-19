import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  Keyboard,
  StatusBar,
  GestureResponderEvent,
  Dimensions,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useHaptics } from '../../hooks/useHaptics';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useDraftMessages } from '../../hooks/useDraftMessages';
import { useHapticReactions, HapticPattern } from '../../hooks/useHapticReactions';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import HapticReactionPicker from '../../components/HapticReactionPicker';
import HapticMessage from '../../components/HapticMessage';
import VoiceMessage from '../../components/VoiceMessage';
import FileMessage from '../../components/FileMessage';
import ImageMessage from '../../components/ImageMessage';
import VideoMessage from '../../components/VideoMessage';
import { mediaCache } from '../../lib/mediaCache';
import Reanimated, { 
  FadeIn,
  useAnimatedStyle, 
  withSpring,
  useSharedValue 
} from 'react-native-reanimated';

import { 
  ChevronLeft, 
  ArrowUp,
  Plus,
  Users,
  Zap,
  Mic,
  Trash2,
  Send,
  Image as ImageIcon,
  FileText,
  Video,
  X
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  time: string;
  read?: boolean;
  created_at: string;
  type?: string;
  metadata?: {
    audio_url?: string;
    duration?: number;
    image_url?: string;
    video_url?: string;
    file_url?: string;
    file_name?: string;
    file_size?: number;
    [key: string]: any;
  };
  audio_url?: string;
  duration?: number;
}

// Memoized message bubble component
const MessageBubble = memo(({ 
  item, 
  isMe, 
  showAvatar,
  avatar,
  isDark,
  theme,
  scale 
}: any) => {
  const scaleAnim = useSharedValue(0.95);
  const opacityAnim = useSharedValue(0);

  useEffect(() => {
    scaleAnim.value = withSpring(1, { damping: 15, stiffness: 150 });
    opacityAnim.value = withSpring(1, { damping: 20 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
    opacity: opacityAnim.value,
  }));

  const s = (size: number) => size * scale;

  return (
    <Reanimated.View style={[{ flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end' }, animatedStyle]}>
      {!isMe && showAvatar && avatar}
      {!isMe && !showAvatar && <View style={{ width: s(36) }} />}
      
      <View style={{
        maxWidth: '78%',
        backgroundColor: isMe ? theme.primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
        borderRadius: s(24),
        paddingHorizontal: s(14),
        paddingVertical: s(10),
        marginHorizontal: s(8),
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text style={{
            color: isMe ? '#fff' : theme.text,
            fontSize: s(16),
            lineHeight: s(22),
            fontWeight: '400',
            marginRight: s(4),
          }}>
            {item.text}
          </Text>
          
          <Text style={{
            color: isMe ? 'rgba(255,255,255,0.7)' : theme.textMuted,
            fontSize: s(11),
            fontWeight: '500',
          }}>
            {item.time}
          </Text>
        </View>
      </View>
    </Reanimated.View>
  );
});

MessageBubble.displayName = 'MessageBubble';

// Memoized recording overlay
const RecordingOverlay = memo(({ 
  isVisible, 
  duration, 
  formatDuration, 
  theme, 
  isDark, 
  scale,
  onCancel,
}: { 
  isVisible: boolean; 
  duration: number; 
  formatDuration: (s: number) => string;
  theme: any;
  isDark: boolean;
  scale: number;
  onCancel: () => void;
}) => {
  const s = (size: number) => size * scale;
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (isVisible) {
      pulseAnim.value = withSpring(1.2, { damping: 10, stiffness: 100 });
    } else {
      pulseAnim.value = 1;
    }
  }, [isVisible]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  if (!isVisible) return null;

  return (
    <View style={{
      position: 'absolute',
      bottom: s(100),
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 100,
    }}>
      <View style={{
        backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
        borderRadius: s(20),
        paddingHorizontal: s(24),
        paddingVertical: s(16),
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
      }}>
        <Reanimated.View style={[{
          width: s(12),
          height: s(12),
          borderRadius: s(6),
          backgroundColor: '#EF4444',
          marginRight: s(12),
        }, pulseStyle]} />
        <Text style={{
          color: theme.text,
          fontSize: s(16),
          fontWeight: '600',
          marginRight: s(16),
        }}>
          Recording {formatDuration(duration)}
        </Text>
        <TouchableOpacity onPress={onCancel}>
          <Trash2 size={s(20)} color="#EF4444" />
        </TouchableOpacity>
      </View>
      <Text style={{
        color: theme.textMuted,
        fontSize: s(12),
        marginTop: s(8),
      }}>
        Slide left to cancel
      </Text>
    </View>
  );
});

RecordingOverlay.displayName = 'RecordingOverlay';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme, isDark, scale } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { trigger } = useHaptics();
  const { saveDraft, getDraft, clearDraft } = useDraftMessages();
  const voiceRecorder = useVoiceRecorder();
  
  const s = (size: number) => size * scale;
  
  const [inputText, setInputText] = useState('');
  const [conversationDetails, setConversationDetails] = useState<{
    other_user_id?: string;
    other_user_name?: string;
    other_user_username?: string;
    is_online?: boolean;
    other_user_avatar?: string;
    is_group?: boolean;
    group_name?: string;
    group_avatar?: string;
  } | null>(null);
  
  const { 
    messages: supabaseMessages, 
    loading, 
    loadingMore,
    hasMore,
    sendMessage: sendMessageToSupabase,
    loadMore,
  } = useRealtimeMessages(id as string, user?.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showHapticPicker, setShowHapticPicker] = useState(false);
  const { sendHapticReaction } = useHapticReactions();
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartX, setRecordingStartX] = useState(0);
  const [hasRecordingPermission, setHasRecordingPermission] = useState<boolean | null>(null);
  
  // Media upload states
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // File size limits
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
  const MAX_VIDEO_DURATION = 60; // 60 seconds

  // Upload file to Supabase Storage
  const uploadFile = async (uri: string, fileName: string, contentType: string): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session');
        return null;
      }

      // Check file size
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }
      
      if (fileInfo.size && fileInfo.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
      }

      const filePath = `${session.user.id}/${Date.now()}_${fileName}`;
      
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // Convert to Uint8Array
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Determine bucket based on content type
      let bucket = 'files';
      if (contentType.startsWith('image/')) bucket = 'images';
      if (contentType.startsWith('video/')) bucket = 'videos';

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, bytes, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  };

  // Pick and send image
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploading(true);
        const asset = result.assets[0];
        
        const fileName = asset.uri.split('/').pop() || `image_${Date.now()}.jpg`;
        const contentType = asset.mimeType || 'image/jpeg';
        
        const publicUrl = await uploadFile(asset.uri, fileName, contentType);
        
        if (publicUrl) {
          await sendMessageToSupabase('', 'image', { 
            image_url: publicUrl,
            file_name: fileName,
          });
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send image');
    } finally {
      setIsUploading(false);
      setShowMediaPicker(false);
    }
  };

  // Pick and send video
  const handlePickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'videos',
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploading(true);
        const asset = result.assets[0];
        
        const fileName = asset.uri.split('/').pop() || `video_${Date.now()}.mp4`;
        const contentType = asset.mimeType || 'video/mp4';
        
        const publicUrl = await uploadFile(asset.uri, fileName, contentType);
        
        if (publicUrl) {
          await sendMessageToSupabase('', 'video', { 
            video_url: publicUrl,
            file_name: fileName,
            duration: asset.duration,
          });
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send video');
    } finally {
      setIsUploading(false);
      setShowMediaPicker(false);
    }
  };

  // Pick and send file
  const handlePickFile = async () => {
    try {
      // For file picking, we'll use a simple document picker approach
      // Note: expo-document-picker would be needed for full file support
      // For now, we'll show an alert explaining the limitation
      Alert.alert(
        'File Upload',
        'File upload from device storage requires additional setup. For now, you can send images and videos.',
        [
          { text: 'Send Image', onPress: handlePickImage },
          { text: 'Send Video', onPress: handlePickVideo },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send file');
    } finally {
      setShowMediaPicker(false);
    }
  };

  // Check microphone permission on mount
  useEffect(() => {
    checkMicrophonePermission();
  }, []);

  const checkMicrophonePermission = async () => {
    const { Audio } = await import('expo-av');
    const { status } = await Audio.getPermissionsAsync();
    setHasRecordingPermission(status === 'granted');
  };

  // Keyboard listeners
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => {
      showSubscription.remove();
    };
  }, []);

  // Sync messages - only when supabaseMessages changes
  useEffect(() => {
    if (supabaseMessages.length > 0 || loading === false) {
      const transformed: Message[] = supabaseMessages.map((msg: any) => ({
        id: msg.id,
        text: msg.content,
        sender: msg.sender_id === user?.id ? 'me' : 'them',
        time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: msg.read_by?.includes(user?.id || '') || false,
        created_at: msg.created_at,
        type: msg.type,
        metadata: msg.metadata,
        audio_url: msg.metadata?.audio_url,
        duration: msg.metadata?.duration,
      }));
      setMessages(transformed);
      
      // Scroll to bottom when messages load initially
      if (supabaseMessages.length > 0 && loading) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
      
      // Preload media in background for better performance
      const mediaUrls: Array<{ url: string; type: 'image' | 'video' | 'voice' }> = [];
      supabaseMessages.forEach((msg: any) => {
        if (msg.type === 'image' && msg.metadata?.image_url) {
          mediaUrls.push({ url: msg.metadata.image_url, type: 'image' });
        } else if (msg.type === 'video' && msg.metadata?.video_url) {
          mediaUrls.push({ url: msg.metadata.video_url, type: 'video' });
        } else if ((msg.type === 'voice' || msg.metadata?.audio_url) && msg.metadata?.audio_url) {
          mediaUrls.push({ url: msg.metadata.audio_url, type: 'voice' });
        }
      });
      
      // Preload up to last 20 media items (most recent)
      if (mediaUrls.length > 0) {
        const recentMedia = mediaUrls.slice(-20);
        mediaCache.preloadMultiple(recentMedia);
      }
    }
  }, [supabaseMessages, user?.id, loading]);

  // Fetch conversation details
  useEffect(() => {
    if (!id) return;
    const fetchDetails = async () => {
      const { data, error } = await supabase.rpc('get_conversation_details', {
        p_conversation_id: id
      });
      if (!error && data?.length > 0) {
        setConversationDetails(data[0]);
      }
    };
    fetchDetails();
  }, [id]);

  // Load draft
  useEffect(() => {
    loadDraft();
  }, []);

  const loadDraft = async () => {
    const draft = await getDraft(id as string);
    if (draft) setInputText(draft);
  };

  // Auto-save draft
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (inputText.trim()) saveDraft(id as string, inputText);
      else clearDraft(id as string);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [inputText, id]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    trigger('light');
    await sendMessageToSupabase(inputText.trim(), 'text');
    setInputText('');
    clearDraft(id as string);
    
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Upload voice message to Supabase
  const uploadVoiceMessage = async (uri: string, duration: number): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session');
        return null;
      }
      
      const fileExt = 'm4a';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      // Read file as base64 using expo-file-system
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // Convert base64 to Uint8Array for upload
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { data, error: uploadError } = await supabase.storage
        .from('voice_messages')
        .upload(filePath, bytes, {
          contentType: 'audio/m4a',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('voice_messages')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Failed to upload voice message:', error);
      return null;
    }
  };

  // Send voice message
  const sendVoiceMessage = async (uri: string, duration: number) => {
    if (!user?.id || !id) return;

    trigger('light');
    
    const audioUrl = await uploadVoiceMessage(uri, duration);
    if (!audioUrl) {
      console.error('Failed to upload voice message');
      return;
    }

    await sendMessageToSupabase('', 'voice', { audio_url: audioUrl, duration });
    
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Voice recording handlers
  const handleMicPressIn = async (event: GestureResponderEvent) => {
    if (inputText.trim()) return;
    
    setRecordingStartX(event.nativeEvent.pageX);
    const started = await voiceRecorder.startRecording();
    if (started) {
      setIsRecording(true);
      trigger('medium');
    }
  };

  const handleMicPressOut = async () => {
    if (!isRecording) return;
    
    setIsRecording(false);
    const uri = await voiceRecorder.stopRecording();
    
    if (uri && voiceRecorder.duration > 1) {
      await sendVoiceMessage(uri, voiceRecorder.duration);
    }
  };

  const handleMicMove = (event: GestureResponderEvent) => {
    if (!isRecording) return;
    
    const diff = recordingStartX - event.nativeEvent.pageX;
    if (diff > 100) {
      voiceRecorder.cancelRecording();
      setIsRecording(false);
      trigger('heavy');
    }
  };

  const shouldShowTimestamp = useCallback((current: Message, previous: Message | null) => {
    if (!previous) return true;
    const currentDate = new Date(current.created_at);
    const previousDate = new Date(previous.created_at);
    const diff = currentDate.getTime() - previousDate.getTime();
    return diff > 5 * 60 * 1000;
  }, []);

  const formatTimestamp = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();
    
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  }, []);

  const renderAvatar = useCallback((isLastInGroup: boolean) => {
    if (!isLastInGroup) return null;
    
    return (
      <View style={{
        width: s(32),
        height: s(32),
        borderRadius: s(16),
        backgroundColor: theme.primary,
        overflow: 'hidden',
        marginRight: s(4),
      }}>
        {conversationDetails?.other_user_avatar ? (
          <Image
            source={{ uri: conversationDetails.other_user_avatar }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ 
              color: '#fff', 
              fontSize: s(14), 
              fontWeight: '700',
            }}>
              {conversationDetails?.other_user_name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
    );
  }, [conversationDetails, theme, s]);

  // Memoized message type check to avoid parsing on every render
  const getMessageType = useCallback((item: Message): { 
    isVoice: boolean; 
    isHaptic: boolean; 
    isImage: boolean;
    isVideo: boolean;
    isFile: boolean;
    hapticPattern?: HapticPattern;
  } => {
    const isVoice = item.type === 'voice' || (item.audio_url && item.audio_url.length > 0);
    const isImage = item.type === 'image';
    const isVideo = item.type === 'video';
    const isFile = item.type === 'file';
    
    let isHaptic = item.type === 'haptic';
    let hapticPattern: HapticPattern | undefined;
    
    if (!isHaptic && item.text && item.text.includes('"type":"haptic"')) {
      isHaptic = true;
    }
    
    if (isHaptic) {
      try {
        const parsed = JSON.parse(item.text);
        if (parsed && typeof parsed === 'object' && 'pattern' in parsed) {
          const pattern = parsed.pattern;
          if (typeof pattern === 'string') {
            hapticPattern = pattern as HapticPattern;
          }
        }
      } catch {
        isHaptic = false;
      }
    }
    
    return { isVoice, isHaptic, isImage, isVideo, isFile, hapticPattern } as {
      isVoice: boolean;
      isHaptic: boolean;
      isImage: boolean;
      isVideo: boolean;
      isFile: boolean;
      hapticPattern?: HapticPattern;
    };
  }, []);

  // Memoized renderItem for FlatList
  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender === 'me';
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showTimestamp = shouldShowTimestamp(item, previousMessage);
    const isLastInGroup = index === messages.length - 1 || messages[index + 1]?.sender !== item.sender;
    
    const { isVoice, isHaptic, isImage, isVideo, isFile, hapticPattern } = getMessageType(item);

    return (
      <View style={{ marginBottom: isLastInGroup ? s(12) : s(2) }}>
        {showTimestamp && (
          <Reanimated.View 
            entering={FadeIn.duration(300)}
            style={{ alignItems: 'center', marginVertical: s(20) }}
          >
            <View style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              paddingHorizontal: s(16),
              paddingVertical: s(8),
              borderRadius: s(20),
            }}>
              <Text style={{
                color: theme.textMuted,
                fontSize: s(12),
                fontWeight: '600',
              }}>
                {formatTimestamp(item.created_at)}
              </Text>
            </View>
          </Reanimated.View>
        )}
        
        <View style={{
          flexDirection: 'row',
          justifyContent: isMe ? 'flex-end' : 'flex-start',
          paddingHorizontal: s(12),
          alignItems: 'flex-end',
        }}>
          {isVoice ? (
            <VoiceMessage
              audioUrl={item.audio_url || item.metadata?.audio_url || ''}
              duration={item.duration || item.metadata?.duration}
              isMe={isMe}
              time={item.time}
            />
          ) : isImage ? (
            <ImageMessage
              imageUrl={item.metadata?.image_url || ''}
              isMe={isMe}
              time={item.time}
            />
          ) : isVideo ? (
            <VideoMessage
              videoUrl={item.metadata?.video_url || ''}
              duration={item.metadata?.duration}
              isMe={isMe}
              time={item.time}
            />
          ) : isFile ? (
            <FileMessage
              fileUrl={item.metadata?.file_url || ''}
              fileName={item.metadata?.file_name || 'File'}
              fileSize={item.metadata?.file_size}
              isMe={isMe}
              time={item.time}
            />
          ) : isHaptic && hapticPattern ? (
            <HapticMessage
              pattern={hapticPattern}
              isMe={isMe}
              time={item.time}
              isLastInGroup={isLastInGroup}
              shouldPlay={!isMe}
            />
          ) : (
            <MessageBubble
              item={item}
              isMe={isMe}
              showAvatar={!isMe && isLastInGroup}
              avatar={renderAvatar(isLastInGroup)}
              isDark={isDark}
              theme={theme}
              scale={scale}
            />
          )}
        </View>
      </View>
    );
  }, [messages, shouldShowTimestamp, formatTimestamp, getMessageType, renderAvatar, isDark, theme, scale, s]);

  // Memoized keyExtractor
  const keyExtractor = useCallback((item: Message) => item.id, []);

  // Memoized onCancel for recording overlay
  const handleCancelRecording = useCallback(() => {
    voiceRecorder.cancelRecording();
    setIsRecording(false);
  }, [voiceRecorder]);

  if (loading && messages.length === 0) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: theme.background, 
        justifyContent: 'center', 
        alignItems: 'center' 
      }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <RecordingOverlay
        isVisible={isRecording}
        duration={voiceRecorder.duration}
        formatDuration={voiceRecorder.formatDuration}
        theme={theme}
        isDark={isDark}
        scale={scale}
        onCancel={handleCancelRecording}
      />
      
      {/* Modern Header */}
      <View style={{
        backgroundColor: theme.background,
        paddingTop: Platform.OS === 'ios' ? s(50) : s(40),
        paddingBottom: s(10),
        paddingHorizontal: s(12),
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 0.5,
        borderBottomColor: theme.border,
      }}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={{
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: theme.surfaceHighlight,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={s(24)} color={theme.text} />
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => {
            if (conversationDetails?.is_group) {
              router.push(`/group-settings/${id}` as any);
            } else if (conversationDetails?.other_user_id) {
              router.push(`/user/${conversationDetails.other_user_id}` as any);
            }
          }}
          style={{
            width: s(44),
            height: s(44),
            borderRadius: s(22),
            backgroundColor: conversationDetails?.is_group && !conversationDetails?.group_avatar 
              ? theme.surfaceHighlight 
              : theme.primary,
            overflow: 'hidden',
            marginHorizontal: s(10),
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: theme.surfaceHighlight,
          }}
        >
          {conversationDetails?.is_group ? (
            conversationDetails?.group_avatar ? (
              <Image
                source={{ uri: conversationDetails.group_avatar }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <Users size={s(22)} color={theme.primary} />
            )
          ) : (
            conversationDetails?.other_user_avatar ? (
              <Image
                source={{ uri: conversationDetails.other_user_avatar }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ 
                color: '#fff', 
                fontSize: s(18), 
                fontWeight: '700',
              }}>
                {conversationDetails?.other_user_name?.[0]?.toUpperCase() || '?'}
              </Text>
            )
          )}
          
          {!conversationDetails?.is_group && conversationDetails?.is_online && (
            <View style={{
              position: 'absolute',
              bottom: -s(2),
              right: -s(2),
              backgroundColor: '#22C55E',
              width: s(14),
              height: s(14),
              borderRadius: s(7),
              borderWidth: 3,
              borderColor: theme.background,
            }} />
          )}
        </TouchableOpacity>
        
        <View style={{ flex: 1 }}>
          <Text style={{
            color: theme.text,
            fontSize: s(17),
            fontWeight: '700',
          }} numberOfLines={1}>
            {conversationDetails?.is_group 
              ? conversationDetails?.group_name || 'Group Chat'
              : conversationDetails?.other_user_name || 'Loading...'
            }
          </Text>
          <Text style={{
            color: conversationDetails?.is_online ? '#22C55E' : theme.textMuted,
            fontSize: s(13),
            fontWeight: '500',
            marginTop: s(1),
          }}>
            {conversationDetails?.is_group 
              ? `${messages.length} messages` 
              : conversationDetails?.is_online 
                ? 'Online' 
                : 'Offline'
            }
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ 
            paddingTop: s(14),
            paddingBottom: s(16),
          }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (messages.length > 0 && !loadingMore) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onLayout={() => {
            if (messages.length > 0 && !loadingMore) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
          // Performance optimizations
          maxToRenderPerBatch={5}
          windowSize={5}
          initialNumToRender={10}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
          // Pagination - load more when scrolling to top
          onScroll={({ nativeEvent }) => {
            if (nativeEvent.contentOffset.y < 50 && hasMore && !loadingMore) {
              loadMore();
            }
          }}
          scrollEventThrottle={400}
          refreshControl={
            <RefreshControl
              refreshing={loadingMore}
              onRefresh={loadMore}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        />

        {/* Modern Input Bar */}
        <View style={{
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + s(4) : s(12),
          paddingTop: s(6),
          paddingHorizontal: s(10),
          backgroundColor: theme.background,
          borderTopWidth: 0.5,
          borderTopColor: theme.border,
        }}>
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderRadius: s(24),
            paddingHorizontal: s(4),
            paddingVertical: s(4),
            borderWidth: 1,
            borderColor: theme.border,
          }}>
            <TouchableOpacity
              onPress={() => setShowMediaPicker(true)}
              style={{
                width: s(38),
                height: s(38),
                borderRadius: s(19),
                backgroundColor: theme.surfaceHighlight,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: s(4),
              }}
            >
              <Plus size={s(22)} color={theme.text} />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={{
                flex: 1,
                color: theme.text,
                fontSize: s(15),
                maxHeight: s(90),
                paddingVertical: s(8),
                paddingHorizontal: s(6),
              }}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor={theme.textMuted}
              multiline
              maxLength={2000}
            />

            {!inputText.trim() ? (
              <TouchableOpacity
                onPress={() => setShowHapticPicker(true)}
                style={{
                  width: s(38),
                  height: s(38),
                  borderRadius: s(19),
                  backgroundColor: `${theme.primary}15`,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: s(4),
                }}
              >
                <Zap size={s(20)} color={theme.primary} />
              </TouchableOpacity>
            ) : null}

            {inputText.trim() ? (
              <TouchableOpacity
                onPress={sendMessage}
                style={{
                  width: s(38),
                  height: s(38),
                  borderRadius: s(19),
                  backgroundColor: theme.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Send size={s(20)} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View
                onTouchStart={handleMicPressIn}
                onTouchEnd={handleMicPressOut}
                style={{
                  width: s(38),
                  height: s(38),
                  borderRadius: s(19),
                  backgroundColor: isRecording ? '#EF4444' : 'transparent',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Mic size={s(22)} color={isRecording ? '#fff' : theme.textMuted} />
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <HapticReactionPicker
        visible={showHapticPicker}
        onClose={() => setShowHapticPicker(false)}
        onSelect={async (pattern) => {
          if (user?.id) {
            await sendHapticReaction(id as string, pattern, supabase, user.id);
          }
        }}
      />

      {/* Media Picker Modal */}
      <Modal
        visible={showMediaPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMediaPicker(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: s(28),
            borderTopRightRadius: s(28),
            paddingHorizontal: s(20),
            paddingTop: s(12),
            paddingBottom: s(30),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 20,
          }}>
            {/* Drag Handle */}
            <View style={{
              alignItems: 'center',
              marginBottom: s(20),
            }}>
              <View style={{
                width: s(40),
                height: s(5),
                borderRadius: s(3),
                backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
              }} />
            </View>

            {/* Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: s(24),
            }}>
              <View>
                <Text style={{
                  color: theme.text,
                  fontSize: s(24),
                  fontWeight: '700',
                }}>
                  Share Content
                </Text>
                <Text style={{
                  color: theme.textMuted,
                  fontSize: s(14),
                  marginTop: s(4),
                }}>
                  Choose what you want to send
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowMediaPicker(false)}
                activeOpacity={0.7}
                style={{
                  width: s(40),
                  height: s(40),
                  borderRadius: s(20),
                  backgroundColor: theme.surfaceHighlight,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <X size={s(22)} color={theme.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Uploading indicator */}
            {isUploading && (
              <View style={{
                alignItems: 'center',
                paddingVertical: s(40),
              }}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={{
                  color: theme.textMuted,
                  fontSize: s(16),
                  fontWeight: '500',
                  marginTop: s(16),
                }}>
                  Uploading your content...
                </Text>
              </View>
            )}

            {/* Options Grid */}
            {!isUploading && (
              <View style={{ gap: s(12) }}>
                {/* Photo Option */}
                <TouchableOpacity
                  onPress={handlePickImage}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: s(16),
                    borderRadius: s(20),
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  }}
                >
                  <View style={{
                    width: s(56),
                    height: s(56),
                    borderRadius: s(18),
                    backgroundColor: `${theme.primary}20`,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: s(16),
                  }}>
                    <ImageIcon size={s(28)} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      color: theme.text,
                      fontSize: s(18),
                      fontWeight: '600',
                    }}>
                      Photo
                    </Text>
                    <Text style={{
                      color: theme.textMuted,
                      fontSize: s(14),
                      marginTop: s(4),
                    }}>
                      Share photos from your gallery
                    </Text>
                  </View>
                  <View style={{
                    width: s(32),
                    height: s(32),
                    borderRadius: s(16),
                    backgroundColor: theme.surfaceHighlight,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <View style={{
                      width: s(8),
                      height: s(8),
                      borderRadius: s(4),
                      backgroundColor: theme.primary,
                    }} />
                  </View>
                </TouchableOpacity>

                {/* Video Option */}
                <TouchableOpacity
                  onPress={handlePickVideo}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: s(16),
                    borderRadius: s(20),
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  }}
                >
                  <View style={{
                    width: s(56),
                    height: s(56),
                    borderRadius: s(18),
                    backgroundColor: `${theme.primary}20`,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: s(16),
                  }}>
                    <Video size={s(28)} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      color: theme.text,
                      fontSize: s(18),
                      fontWeight: '600',
                    }}>
                      Video
                    </Text>
                    <Text style={{
                      color: theme.textMuted,
                      fontSize: s(14),
                      marginTop: s(4),
                    }}>
                      Up to 15MB • MP4, MOV
                    </Text>
                  </View>
                  <View style={{
                    width: s(32),
                    height: s(32),
                    borderRadius: s(16),
                    backgroundColor: theme.surfaceHighlight,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <View style={{
                      width: s(8),
                      height: s(8),
                      borderRadius: s(4),
                      backgroundColor: theme.primary,
                    }} />
                  </View>
                </TouchableOpacity>

                {/* File Option */}
                <TouchableOpacity
                  onPress={handlePickFile}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: s(16),
                    borderRadius: s(20),
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  }}
                >
                  <View style={{
                    width: s(56),
                    height: s(56),
                    borderRadius: s(18),
                    backgroundColor: `${theme.primary}20`,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: s(16),
                  }}>
                    <FileText size={s(28)} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      color: theme.text,
                      fontSize: s(18),
                      fontWeight: '600',
                    }}>
                      Document
                    </Text>
                    <Text style={{
                      color: theme.textMuted,
                      fontSize: s(14),
                      marginTop: s(4),
                    }}>
                      PDF, Word, Excel, up to 15MB
                    </Text>
                  </View>
                  <View style={{
                    width: s(32),
                    height: s(32),
                    borderRadius: s(16),
                    backgroundColor: theme.surfaceHighlight,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <View style={{
                      width: s(8),
                      height: s(8),
                      borderRadius: s(4),
                      backgroundColor: theme.primary,
                    }} />
                  </View>
                </TouchableOpacity>

                {/* Cancel Button */}
                <TouchableOpacity
                  onPress={() => setShowMediaPicker(false)}
                  activeOpacity={0.7}
                  style={{
                    marginTop: s(12),
                    padding: s(16),
                    borderRadius: s(20),
                    backgroundColor: theme.surfaceHighlight,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    color: theme.text,
                    fontSize: s(16),
                    fontWeight: '600',
                  }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
