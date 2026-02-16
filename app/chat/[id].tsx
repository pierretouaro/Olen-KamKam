import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useHaptics } from '../../hooks/useHaptics';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useDraftMessages } from '../../hooks/useDraftMessages';
import Reanimated, { FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { 
  ChevronLeft, 
  Video, 
  ArrowUp,
  Phone,
  MoreHorizontal,
  Send
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  time: string;
  read?: boolean;
  created_at: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme, isDark, scale } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { trigger } = useHaptics();
  const { saveDraft, getDraft, clearDraft } = useDraftMessages();
  
  const [inputText, setInputText] = useState('');
  const [conversationDetails, setConversationDetails] = useState<{
    other_user_id: string;
    other_user_name: string;
    other_user_username: string;
    is_online: boolean;
    other_user_avatar?: string;
  } | null>(null);
  
  const { messages: supabaseMessages, loading, sendMessage: sendMessageToSupabase } = useRealtimeMessages(id as string);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const s = (size: number) => size * scale;

  // Sync messages
  useEffect(() => {
    if (supabaseMessages.length > 0 || loading === false) {
      const transformed: Message[] = supabaseMessages.map((msg: any) => ({
        id: msg.id,
        text: msg.content,
        sender: msg.sender_id === user?.id ? 'me' : 'them',
        time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: msg.read_by?.includes(user?.id || '') || false,
        created_at: msg.created_at,
      }));
      setMessages(transformed);
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
  }, [inputText]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    trigger('medium');
    await sendMessageToSupabase(inputText.trim(), 'text');
    setInputText('');
    clearDraft(id as string);
    
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const shouldShowTimestamp = (current: Message, previous: Message | null) => {
    if (!previous) return true;
    const currentDate = new Date(current.created_at);
    const previousDate = new Date(previous.created_at);
    const diff = currentDate.getTime() - previousDate.getTime();
    return diff > 5 * 60 * 1000; // 5 minutes
  };

  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (isYesterday) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender === 'me';
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showTimestamp = shouldShowTimestamp(item, previousMessage);
    const isFirstInGroup = !previousMessage || previousMessage.sender !== item.sender;
    const isLastInGroup = index === messages.length - 1 || messages[index + 1]?.sender !== item.sender;
    
    return (
      <Reanimated.View
        entering={FadeInUp.duration(250).delay(index * 20)}
        style={{ marginBottom: isLastInGroup ? s(8) : s(2) }}
      >
        {showTimestamp && (
          <View style={{ alignItems: 'center', marginVertical: s(16) }}>
            <View style={{
              backgroundColor: theme.surfaceHighlight,
              paddingHorizontal: s(12),
              paddingVertical: s(6),
              borderRadius: s(12),
            }}>
              <Text style={{
                color: theme.textMuted,
                fontSize: s(12),
                fontFamily: theme.fontFamilyMedium,
                fontWeight: '500',
              }}>
                {formatTimestamp(item.created_at)}
              </Text>
            </View>
          </View>
        )}
        
        <View style={{
          flexDirection: 'row',
          justifyContent: isMe ? 'flex-end' : 'flex-start',
          paddingHorizontal: s(16),
          alignItems: 'flex-end',
        }}>
          {/* Avatar for incoming messages - only show on last message in group */}
          {!isMe && isLastInGroup && (
            <View
              style={{
                width: s(32),
                height: s(32),
                borderRadius: s(16),
                backgroundColor: theme.primary,
                marginRight: s(10),
                overflow: 'hidden',
                borderWidth: 0.5,
                borderColor: theme.border,
              }}
            >
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
                    fontFamily: theme.fontFamilyBold,
                    fontWeight: '700',
                  }}>
                    {conversationDetails?.other_user_name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </View>
          )}
          {!isMe && !isLastInGroup && <View style={{ width: s(42) }} />}
          
          {/* Message Bubble */}
          <View style={{
            maxWidth: '72%',
            backgroundColor: isMe ? theme.outgoingBubble : theme.incomingBubble,
            borderRadius: s(20),
            borderBottomRightRadius: isMe ? (isLastInGroup ? s(4) : s(20)) : s(20),
            borderBottomLeftRadius: !isMe ? (isLastInGroup ? s(4) : s(20)) : s(20),
            borderTopRightRadius: isMe ? (isFirstInGroup ? s(20) : s(20)) : s(20),
            borderTopLeftRadius: !isMe ? (isFirstInGroup ? s(20) : s(20)) : s(20),
            paddingHorizontal: s(14),
            paddingVertical: s(10),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 2,
            elevation: 2,
          }}>
            <Text style={{
              color: isMe ? '#fff' : theme.text,
              fontSize: s(16),
              lineHeight: s(22),
              fontFamily: theme.fontFamily,
              fontWeight: '400',
            }}>
              {item.text}
            </Text>
            
            {/* Time inside bubble for sent messages */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'flex-end', 
              marginTop: s(4),
              alignItems: 'center',
            }}>
              <Text style={{
                color: isMe ? 'rgba(255,255,255,0.7)' : theme.textMuted,
                fontSize: s(11),
                fontFamily: theme.fontFamilyMedium,
                fontWeight: '500',
              }}>
                {item.time}
              </Text>
              {isMe && isLastInGroup && index === messages.length - 1 && (
                <Text style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: s(11),
                  marginLeft: s(4),
                  fontFamily: theme.fontFamilyMedium,
                }}>
                  • Read
                </Text>
              )}
            </View>
          </View>
        </View>
      </Reanimated.View>
    );
  };

  if (loading && messages.length === 0) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: theme.background, 
        justifyContent: 'center', 
        alignItems: 'center' 
      }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header - Matching Contacts/New Chat Style */}
      <View style={{
        backgroundColor: theme.background,
        paddingTop: Platform.OS === 'ios' ? s(60) : s(40),
        paddingBottom: s(16),
        paddingHorizontal: s(20),
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Back Button */}
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
        
        {/* Center - User Info (Name + Online) */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{
            color: theme.text,
            fontSize: s(17),
            fontFamily: theme.fontFamilyBold,
            fontWeight: '700',
          }}>
            {conversationDetails?.other_user_name || 'Loading...'}
          </Text>
          <Text style={{
            color: conversationDetails?.is_online ? theme.primary : theme.textMuted,
            fontSize: s(13),
            fontFamily: theme.fontFamilyMedium,
            fontWeight: '500',
          }}>
            {conversationDetails?.is_online ? 'online' : 'offline'}
          </Text>
        </View>
        
        {/* Right - Avatar */}
        <TouchableOpacity
          onPress={() => conversationDetails?.other_user_id && 
            router.push(`/user/${conversationDetails.other_user_id}` as any)
          }
          style={{
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: theme.primary,
            overflow: 'hidden',
            borderWidth: 0.5,
            borderColor: theme.border,
            position: 'relative',
          }}
        >
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
                fontSize: s(18), 
                fontFamily: theme.fontFamilyBold,
                fontWeight: '700',
              }}>
                {conversationDetails?.other_user_name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          {/* Online indicator dot */}
          {conversationDetails?.is_online && (
            <View style={{
              position: 'absolute',
              bottom: s(2),
              right: s(2),
              backgroundColor: '#10B981',
              width: s(12),
              height: s(12),
              borderRadius: s(6),
              borderWidth: 2,
              borderColor: theme.background,
            }} />
          )}
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ 
          paddingTop: s(12),
          paddingBottom: s(20),
        }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input Bar - Matching App Style */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={{
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + s(8) : s(16),
          paddingTop: s(12),
          paddingHorizontal: s(16),
          backgroundColor: theme.background,
          borderTopWidth: 0.5,
          borderTopColor: theme.border,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
            borderRadius: s(28),
            paddingHorizontal: s(16),
            paddingVertical: s(8),
            minHeight: s(52),
            borderWidth: 0.5,
            borderColor: theme.border,
          }}>
            <TextInput
              ref={inputRef}
              style={{
                flex: 1,
                color: theme.text,
                fontSize: s(16),
                fontFamily: theme.fontFamily,
                fontWeight: '400',
                maxHeight: s(100),
                paddingVertical: s(8),
              }}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message..."
              placeholderTextColor={theme.textMuted}
              multiline
              maxLength={2000}
            />
            
            {inputText.trim() ? (
              <TouchableOpacity
                onPress={sendMessage}
                style={{
                  width: s(36),
                  height: s(36),
                  borderRadius: s(18),
                  backgroundColor: theme.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginLeft: s(8),
                  shadowColor: theme.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Send size={s(20)} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{
                  width: s(36),
                  height: s(36),
                  borderRadius: s(18),
                  backgroundColor: theme.primaryLight,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginLeft: s(8),
                }}
              >
                <Phone size={s(20)} color={theme.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}