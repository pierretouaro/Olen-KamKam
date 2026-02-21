import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ChevronLeft, User, FileText, AtSign, Edit3, Sparkles } from 'lucide-react-native';

interface Activity {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_username: string;
  actor_avatar: string | null;
  activity_type: 'bio_added' | 'bio_changed' | 'username_changed' | 'full_name_changed' | 'story_added' | 'joined_olen';
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  is_seen: boolean;
}

export default function ActivityScreen() {
  const router = useRouter();
  const { theme, isDark, scale } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const s = (size: number) => size * scale;

  const fetchActivities = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .rpc('get_user_activities', { p_user_id: user.id });

      if (error) throw error;

      setActivities(data || []);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const markAllAsSeen = useCallback(async () => {
    if (!user) return;

    try {
      // Get unseen activity IDs
      const unseenIds = activities.filter(a => !a.is_seen).map(a => a.id);
      
      if (unseenIds.length > 0) {
        const inserts = unseenIds.map(id => ({
          user_id: user.id,
          activity_id: id,
        }));

        await supabase.from('seen_activities').insert(inserts);
        
        // Update local state to mark all as seen
        setActivities(prev => prev.map(a => ({ ...a, is_seen: true })));
      }
    } catch (err) {
      console.error('Error marking as seen:', err);
    }
  }, [user, activities]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Mark all as seen when component mounts and activities are loaded
  useEffect(() => {
    if (activities.length > 0 && !loading) {
      markAllAsSeen();
    }
  }, [activities.length, loading, markAllAsSeen]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivities();
  };

  const getActivityIcon = (type: Activity['activity_type']) => {
    switch (type) {
      case 'bio_added':
      case 'bio_changed':
        return <FileText size={s(20)} color={theme.primary} />;
      case 'username_changed':
        return <AtSign size={s(20)} color={theme.primary} />;
      case 'full_name_changed':
        return <Edit3 size={s(20)} color={theme.primary} />;
      case 'story_added':
        return <Sparkles size={s(20)} color={theme.primary} />;
      case 'joined_olen':
        return <User size={s(20)} color={theme.primary} />;
      default:
        return <User size={s(20)} color={theme.primary} />;
    }
  };

  const getActivityText = (activity: Activity) => {
    const name = activity.actor_name || activity.actor_username;
    
    switch (activity.activity_type) {
      case 'bio_added':
        return `${name} added a bio`;
      case 'bio_changed':
        return `${name} updated their bio`;
      case 'username_changed':
        return `${name} changed their username`;
      case 'full_name_changed':
        return `${name} changed their name`;
      case 'story_added':
        return `${name} added a story`;
      case 'joined_olen':
        return `${name} joined Olen`;
      default:
        return `${name} made a change`;
    }
  };

  const getActivitySubtext = (activity: Activity) => {
    switch (activity.activity_type) {
      case 'bio_added':
      case 'bio_changed':
        return activity.new_value;
      case 'username_changed':
        return activity.new_value ? `@${activity.new_value}` : null;
      case 'full_name_changed':
        return activity.new_value;
      case 'story_added':
        return activity.new_value;
      default:
        return null;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const ActivityItem = ({ activity, isLast }: { activity: Activity; isLast: boolean }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      style={{
        flexDirection: 'row',
        padding: s(16),
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: theme.border,
        backgroundColor: activity.is_seen ? 'transparent' : theme.primaryLight,
      }}
      onPress={() => router.push(`/user/${activity.actor_id}`)}
    >
      {/* Avatar */}
      <View style={{
        width: s(50),
        height: s(50),
        borderRadius: s(25),
        marginRight: s(12),
        overflow: 'hidden',
        backgroundColor: theme.primary,
      }}>
        {activity.actor_avatar ? (
          <Image
            source={{ uri: activity.actor_avatar }}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View style={{
            width: '100%',
            height: '100%',
            backgroundColor: theme.primary,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{
              color: '#fff',
              fontSize: s(20),
              fontWeight: '700',
              fontFamily: theme.fontFamilyBold,
            }}>
              {activity.actor_name?.[0]?.toUpperCase() || activity.actor_username?.[0]?.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(4) }}>
          {getActivityIcon(activity.activity_type)}
          <Text style={{
            color: theme.text,
            fontSize: s(15),
            fontFamily: theme.fontFamilyMedium,
            marginLeft: s(8),
            flex: 1,
          }}>
            {getActivityText(activity)}
          </Text>
          <Text style={{
            color: theme.textMuted,
            fontSize: s(12),
            fontFamily: theme.fontFamily,
            marginLeft: s(8),
          }}>
            {formatTime(activity.created_at)}
          </Text>
        </View>

        {getActivitySubtext(activity) && (
          <Text
            style={{
              color: theme.textMuted,
              fontSize: s(14),
              fontFamily: theme.fontFamily,
              marginLeft: s(28),
              marginTop: s(2),
            }}
            numberOfLines={2}
          >
            "{getActivitySubtext(activity)}"
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + s(10),
        paddingBottom: s(10),
        paddingHorizontal: s(20),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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

        <Text style={{ 
          color: theme.text, 
          fontSize: s(20), 
          fontWeight: '700',
          fontFamily: theme.fontFamilyBold,
        }}>
          Activity
        </Text>

        <View style={{ width: s(40) }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + s(20) }}
      >
        {activities.length === 0 ? (
          <View style={{ padding: s(40), alignItems: 'center' }}>
            <Text style={{
              color: theme.textMuted,
              fontSize: s(16),
              fontFamily: theme.fontFamily,
              textAlign: 'center',
            }}>
              No recent activity from your contacts
            </Text>
          </View>
        ) : (
          <View style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#fff',
            borderRadius: s(16),
            margin: s(16),
            borderWidth: 0.5,
            borderColor: theme.border,
            overflow: 'hidden',
          }}>
            {activities.map((activity, index) => (
              <ActivityItem 
                key={activity.id} 
                activity={activity} 
                isLast={index === activities.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
