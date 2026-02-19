import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, Modal, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { 
  ChevronLeft, 
  User,
  AtSign,
  Phone,
  FileText,
  MessageCircle,
  Phone as PhoneIcon,
  Video,
  Clock3,
  X
} from 'lucide-react-native';

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  phone_number: string;
  bio: string;
  avatar_url?: string;
  status?: string;
  last_seen?: string;
}

interface UserStory {
  id: string;
  image_url: string;
  created_at: string;
  expires_at: string;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme, isDark, scale } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [story, setStory] = useState<UserStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingStory, setViewingStory] = useState(false);

  const s = (size: number) => size * scale;

  // Get the user ID string from the params
  const userId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      const [{ data: profileData, error: profileError }, { data: storyData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        supabase
          .from('stories')
          .select('*')
          .eq('user_id', userId)
          .gt('expires_at', new Date().toISOString())
          .single(),
      ]);
        
      if (profileError) throw profileError;
      setProfile(profileData);
      setStory(storyData);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate online status based on last_seen
  const isOnline = (profile: UserProfile | null): boolean => {
    if (!profile?.last_seen) return false;
    const lastSeen = new Date(profile.last_seen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSeen > fiveMinutesAgo;
  };

  const ProfileField = ({ 
    icon, 
    label, 
    value, 
    placeholder,
    isLast = false
  }: { 
    icon: React.ReactNode;
    label: string;
    value: string;
    placeholder: string;
    isLast?: boolean;
  }) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      padding: s(16),
      borderBottomWidth: isLast ? 0 : 0.5,
      borderBottomColor: theme.border,
    }}>
      <View style={{
        backgroundColor: theme.primaryLight,
        width: s(44),
        height: s(44),
        borderRadius: s(12),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: s(16),
      }}>
        {icon}
      </View>
      
      <View style={{ flex: 1 }}>
        <Text style={{
          color: theme.textMuted,
          fontSize: s(13),
          fontFamily: theme.fontFamilyMedium,
          marginBottom: s(4),
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          {label}
        </Text>
        <Text style={{
          color: value ? theme.text : theme.textMuted,
          fontSize: s(16),
          fontFamily: theme.fontFamily,
        }}>
          {value || placeholder}
        </Text>
      </View>
    </View>
  );

  const ProfileMenuSection = ({ children }: { children: React.ReactNode }) => (
    <View style={{
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#fff',
      borderRadius: s(16),
      marginBottom: s(12),
      borderWidth: 0.5,
      borderColor: theme.border,
      overflow: 'hidden',
    }}>
      {children}
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Text style={{ color: theme.text }}>User not found</Text>
      </View>
    );
  }

  const online = isOnline(profile);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={{
        paddingTop: insets.top + s(10),
        paddingBottom: s(10),
        paddingHorizontal: s(20),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
          Contact Info
        </Text>

        <View style={{ width: s(40) }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          padding: s(20), 
          paddingBottom: s(100) 
        }}
      >
        {/* Profile Header */}
        <View style={{ alignItems: 'center', marginBottom: s(32) }}>
          {/* Avatar */}
          <View style={{
            position: 'relative',
            marginBottom: s(16),
          }}>
            {profile.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={{
                  width: s(120),
                  height: s(120),
                  borderRadius: s(60),
                }}
                resizeMode="cover"
              />
            ) : (
              <View style={{
                backgroundColor: theme.primary,
                width: s(120),
                height: s(120),
                borderRadius: s(60),
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ 
                  fontSize: s(48), 
                  color: '#fff', 
                  fontWeight: '700',
                  fontFamily: theme.fontFamilyBold,
                }}>
                  {profile.full_name?.[0]?.toUpperCase() || profile.username?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            
            {/* Online indicator */}
            {online && (
              <View style={{
                position: 'absolute',
                bottom: s(8),
                right: s(8),
                backgroundColor: '#10B981',
                width: s(24),
                height: s(24),
                borderRadius: s(12),
                borderWidth: 3,
                borderColor: theme.background,
              }} />
            )}
          </View>

          {/* Name */}
          <Text style={{
            color: theme.text,
            fontSize: s(28),
            fontWeight: '700',
            fontFamily: theme.fontFamilyBold,
            marginBottom: s(8),
          }}>
            {profile.full_name || 'Unknown'}
          </Text>

          {/* Username */}
          <Text style={{
            color: theme.textMuted,
            fontSize: s(16),
            fontFamily: theme.fontFamily,
            marginBottom: story ? s(16) : s(24),
          }}>
            @{profile.username || 'username'}
          </Text>

          {/* Story Preview */}
          {story && (
            <TouchableOpacity 
              onPress={() => setViewingStory(true)}
              style={{
                marginBottom: s(24),
                borderRadius: s(16),
                overflow: 'hidden',
                borderWidth: 3,
                borderColor: theme.primary,
              }}
            >
              <Image
                source={{ uri: story.image_url }}
                style={{
                  width: s(200),
                  height: s(280),
                  borderRadius: s(13),
                }}
                resizeMode="cover"
              />
              <View style={{
                position: 'absolute',
                bottom: s(12),
                left: s(12),
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(4),
                backgroundColor: 'rgba(0,0,0,0.5)',
                paddingHorizontal: s(8),
                paddingVertical: s(4),
                borderRadius: s(12),
              }}>
                <Clock3 size={s(11)} color="#fff" />
                <Text style={{
                  color: '#fff',
                  fontSize: s(11),
                  fontWeight: '600',
                }}>
                  {new Date(story.expires_at).getTime() - Date.now() > 0 
                    ? `${Math.ceil((new Date(story.expires_at).getTime() - Date.now()) / (1000 * 60 * 60))}h left`
                    : 'Expired'
                  }
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: s(16) }}>
            <TouchableOpacity 
              style={{
                backgroundColor: theme.primary,
                width: s(56),
                height: s(56),
                borderRadius: s(28),
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => router.push(`/chat/${userId}` as any)}
            >
              <MessageCircle size={s(24)} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={{
                backgroundColor: theme.primaryLight,
                width: s(56),
                height: s(56),
                borderRadius: s(28),
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 0.5,
                borderColor: theme.border,
              }}
            >
              <PhoneIcon size={s(24)} color={theme.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={{
                backgroundColor: theme.primaryLight,
                width: s(56),
                height: s(56),
                borderRadius: s(28),
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 0.5,
                borderColor: theme.border,
              }}
            >
              <Video size={s(24)} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info Section */}
        <ProfileMenuSection>
          <ProfileField
            icon={<User size={s(22)} color={theme.primary} />}
            label="Full Name"
            value={profile.full_name || ''}
            placeholder="No name set"
          />
          <ProfileField
            icon={<AtSign size={s(22)} color={theme.primary} />}
            label="Username"
            value={profile.username || ''}
            placeholder="No username set"
          />
          <ProfileField
            icon={<Phone size={s(22)} color={theme.primary} />}
            label="Phone Number"
            value={profile.phone_number || ''}
            placeholder="No phone number set"
          />
          <ProfileField
            icon={<FileText size={s(22)} color={theme.primary} />}
            label="Bio"
            value={profile.bio || ''}
            placeholder="No bio yet..."
            isLast
          />
        </ProfileMenuSection>
      </ScrollView>

      {/* Story Viewer Modal */}
      <Modal
        visible={viewingStory}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingStory(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          {story && (
            <>
              <Image
                source={{ uri: story.image_url }}
                style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height }}
                resizeMode="contain"
              />
              <TouchableOpacity 
                onPress={() => setViewingStory(false)}
                style={{
                  position: 'absolute',
                  top: 50,
                  right: 20,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <X size={28} color="#fff" />
              </TouchableOpacity>
              <View style={{
                position: 'absolute',
                bottom: 100,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(0,0,0,0.5)',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
              }}>
                <Clock3 size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                  {new Date(story.expires_at).getTime() - Date.now() > 0 
                    ? `${Math.ceil((new Date(story.expires_at).getTime() - Date.now()) / (1000 * 60 * 60))}h left`
                    : 'Expired'
                  }
                </Text>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}
