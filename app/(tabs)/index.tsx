import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Image, // Added Image import
} from 'react-native';
import NotesBar from '../../components/NotesBar';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';
import { 
  Search, 
  Plus, 
  CheckCheck, 
  ChevronLeft,
  MessageSquare,
  Users,
  MoreHorizontal,
  Archive,
  X,
  Bell
} from 'lucide-react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface ProcessedConversation {
  id: string;
  name: string;
  message: string;
  time: string;
  unread: number;
  sent: boolean;
  read: boolean;
  avatar: string;
  avatarUrl?: string; // Added avatar URL
  isGroup: boolean;
  color: string;
  otherUserId: string;
  isOnline?: boolean;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { theme, isDark, scale } = useTheme();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ProcessedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unseenActivityCount, setUnseenActivityCount] = useState(0);

  const s = (size: number) => size * scale;

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_user_conversations');
      
      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      const formatMessageTime = (dateString: string): string => {
        const messageDate = new Date(dateString);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
        
        if (messageDay.getTime() === today.getTime()) {
          return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (messageDay.getTime() === yesterday.getTime()) {
          return 'Yesterday';
        } else if (messageDay.getTime() > oneWeekAgo.getTime()) {
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          return days[messageDate.getDay()];
        } else {
          return messageDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        }
      };

      const processedConversations: ProcessedConversation[] = (data || []).map((item: any) => ({
        id: item.conversation_id,
        name: item.other_user_name || item.other_user_username || 'Unknown',
        message: item.last_message_content || 'No messages yet',
        time: item.last_message_time 
          ? formatMessageTime(item.last_message_time)
          : '',
        unread: parseInt(item.unread_count) || 0,
        sent: false,
        read: parseInt(item.unread_count) === 0,
        avatar: (item.other_user_name || item.other_user_username || '?')[0].toUpperCase(),
        avatarUrl: item.other_user_avatar, // Map the avatar URL from RPC
        isGroup: item.conversation_type === 'group',
        color: '#6366F1',
        otherUserId: item.other_user_id,
        isOnline: item.is_online || false,
      }));

      setConversations(processedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const fetchUnseenActivityCount = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_unseen_activity_count', { p_user_id: user.id });
      
      if (error) throw error;
      
      setUnseenActivityCount(data || 0);
    } catch (err) {
      console.error('Error fetching activity count:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();
    
    // Subscribe to message changes
    const messageSubscription = supabase
      .channel('messages_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      messageSubscription.unsubscribe();
    };
  }, [fetchConversations]);

  // Refresh activity count when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchUnseenActivityCount();
      
      // Subscribe to activity changes
      const activitySubscription = supabase
        .channel('activity_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => {
          fetchUnseenActivityCount();
        })
        .subscribe();
      
      return () => {
        activitySubscription.unsubscribe();
      };
    }, [fetchUnseenActivityCount])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const filteredChats = conversations.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderConversation = ({ item, index }: { item: ProcessedConversation; index: number }) => (
    <Animated.View
      entering={FadeInUp.duration(300).delay(index * 30)}
    >
      <TouchableOpacity 
        style={{
          backgroundColor: 'transparent',
          paddingVertical: s(11),
          paddingHorizontal: s(16),
          flexDirection: 'row',
          alignItems: 'center',
        }}
        onPress={() => router.push(`/chat/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <TouchableOpacity
          style={{
            width: s(58),
            height: s(58),
            borderRadius: s(29),
            marginRight: s(16),
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: theme.primary,
          }}
          onPress={(e) => {
            e.stopPropagation();
            router.push(`/user/${item.otherUserId}` as any);
          }}
          activeOpacity={0.8}
        >
          {item.avatarUrl ? (
            <Image 
              source={{ uri: item.avatarUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{
                color: '#fff',
                fontSize: s(24),
                fontWeight: '600',
                fontFamily: theme.fontFamilyMedium,
              }}>
                {item.avatar}
              </Text>
            </View>
          )}
          {item.isOnline && (
            <View style={{
              position: 'absolute',
              bottom: s(2),
              right: s(2),
              backgroundColor: '#10B981',
              width: s(18),
              height: s(18),
              borderRadius: s(9),
              borderWidth: 2,
              borderColor: theme.background,
            }} />
          )}
        </TouchableOpacity>
        
        <View style={{ flex: 1 }}>
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: s(4),
          }}>
            <Text style={{
              color: theme.text,
              fontSize: s(17),
              fontWeight: '600',
              fontFamily: theme.fontFamilyMedium,
              flex: 1,
              marginRight: s(8),
            }} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={{
              color: theme.textMuted,
              fontSize: s(13),
              fontWeight: '400',
              fontFamily: theme.fontFamily,
            }}>
              {item.time}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {item.sent && (
              <CheckCheck 
                size={s(14)} 
                color={item.read ? theme.primary : theme.textMuted} 
                style={{ marginRight: s(4) }}
              />
            )}
            <Text 
              style={{
                color: theme.textMuted,
                fontSize: s(15),
                fontWeight: '400',
                fontFamily: theme.fontFamily,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {item.message}
            </Text>
            
            {item.unread > 0 ? (
              <View style={{
                backgroundColor: theme.primary,
                minWidth: s(24),
                height: s(24),
                borderRadius: s(12),
                paddingHorizontal: s(6),
                justifyContent: 'center',
                alignItems: 'center',
                marginLeft: s(8),
              }}>
                <Text style={{
                  color: '#fff',
                  fontSize: s(14),
                  fontWeight: '600',
                  fontFamily: theme.fontFamilyMedium,
                }}>
                  {item.unread > 99 ? '99+' : item.unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
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
      
      {/* Clean Header */}
      <View style={{
        backgroundColor: theme.background,
        paddingTop: Platform.OS === 'ios' ? s(60) : s(40),
        paddingBottom: s(20),
        paddingHorizontal: s(20),
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: s(20),
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{
              color: theme.text,
              fontSize: s(28),
              fontWeight: '700',
              fontFamily: theme.fontFamilyBold,
            }}>
              Messages
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', gap: s(8) }}>
            <TouchableOpacity 
              style={{
                width: s(44),
                height: s(44),
                borderRadius: s(22),
                backgroundColor: theme.surfaceHighlight,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => router.push('/activity')}
            >
              <Bell size={s(22)} color={theme.text} />
              {unseenActivityCount > 0 && (
                <View style={{
                  position: 'absolute',
                  bottom: s(8),
                  right: s(8),
                  width: s(14),
                  height: s(14),
                  borderRadius: s(7),
                  backgroundColor: '#EF4444',
                  borderWidth: 2,
                  borderColor: theme.surfaceHighlight,
                }} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={{
                width: s(44),
                height: s(44),
                borderRadius: s(22),
                backgroundColor: theme.primary,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => router.push('/new-chat')}
            >
              <Plus size={s(24)} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar - Floating Blur */}
        <View style={{
          borderRadius: s(28),
          height: s(56),
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
          borderWidth: 0.5,
          borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
        }}>
          <BlurView
            tint={isDark ? 'dark' : 'light'}
            intensity={60}
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: theme.surface,
            }}
          />
          <View style={{ paddingHorizontal: s(16), flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Search size={s(20)} color={theme.textMuted} />
            <TextInput
              style={{
                flex: 1,
                color: theme.text,
                fontSize: s(16),
                marginLeft: s(12),
                fontWeight: '500',
              }}
              placeholder="Search messages..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => setSearchQuery('')}
                style={{
                  backgroundColor: theme.primaryLight,
                  borderRadius: s(12),
                  padding: s(4),
                }}
              >
                <X size={s(16)} color={theme.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Notes Bar */}
      <NotesBar />

      {/* Conversations List */}
      {filteredChats.length > 0 ? (
        <FlatList
          data={filteredChats}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingBottom: s(100),
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
        />
      ) : (
        !loading && (
          <View style={{ 
            padding: s(40), 
            alignItems: 'center',
            marginTop: s(60),
          }}>
            <View style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.03)',
              width: s(100),
              height: s(100),
              borderRadius: s(50),
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: s(24),
              borderWidth: 0.5,
              borderColor: theme.border,
            }}>
              <MessageSquare size={s(48)} color={theme.textMuted} />
            </View>
            <Text style={{
              color: theme.text,
              fontSize: s(20),
              fontWeight: '700',
              fontFamily: theme.fontFamilyBold,
              marginBottom: s(8),
            }}>
              No messages yet
            </Text>
            <Text style={{
              color: theme.textMuted,
              fontSize: s(16),
              fontFamily: theme.fontFamily,
              textAlign: 'center',
              marginBottom: s(24),
              lineHeight: s(24),
            }}>
              Start a conversation with your friends and family
            </Text>
            <TouchableOpacity 
              style={{
                backgroundColor: theme.primary,
                paddingHorizontal: s(32),
                paddingVertical: s(16),
                borderRadius: s(16),
                flexDirection: 'row',
                alignItems: 'center',
              }}
              onPress={() => router.push('/new-chat')}
            >
              <Plus size={s(20)} color="#fff" style={{ marginRight: s(8) }} />
              <Text style={{
                color: '#fff',
                fontSize: s(17),
                fontWeight: '700',
                fontFamily: theme.fontFamilyBold,
              }}>
                New Chat
              </Text>
            </TouchableOpacity>
          </View>
        )
      )}
    </View>
  );
}