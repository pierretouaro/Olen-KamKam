import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useGroups, GroupMember } from '../../hooks/useGroups';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { 
  ChevronLeft, 
  Camera, 
  Users,
  Crown,
  LogOut
} from 'lucide-react-native';

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme, isDark, scale } = useTheme();
  const { getGroupMembers, updateGroupAvatar, uploadGroupAvatar, loading } = useGroups();
  const insets = useSafeAreaInsets();
  
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupInfo, setGroupInfo] = useState<{
    name: string;
    avatar_url?: string;
    created_by?: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  const s = (size: number) => size * scale;

  useEffect(() => {
    loadGroupData();
  }, [id]);

  const loadGroupData = async () => {
    if (!id) return;
    
    // Fetch members
    const membersList = await getGroupMembers(id as string);
    setMembers(membersList);
    
    // Fetch group info
    const { data } = await supabase
      .from('conversations')
      .select('name, avatar_url, created_by')
      .eq('id', id)
      .single();
      
    if (data) {
      setGroupInfo(data);
    }
  };

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setUploading(true);
      
      // Upload the image
      const avatarUrl = await uploadGroupAvatar(result.assets[0].uri, id as string);
      
      if (avatarUrl) {
        // Update the group avatar
        const success = await updateGroupAvatar(id as string, avatarUrl);
        
        if (success) {
          setGroupInfo(prev => prev ? { ...prev, avatar_url: avatarUrl } : null);
          Alert.alert('Success', 'Group photo updated successfully');
        } else {
          Alert.alert('Error', 'Failed to update group photo');
        }
      } else {
        Alert.alert('Error', 'Failed to upload image');
      }
      
      setUploading(false);
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Leave', 
          style: 'destructive',
          onPress: async () => {
            // TODO: Implement leave group functionality
            Alert.alert('Coming Soon', 'Leave group feature will be implemented soon');
          }
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header - Matching Chat Screen Style */}
      <View style={{
        backgroundColor: theme.background,
        paddingTop: Platform.OS === 'ios' ? s(60) : s(40),
        paddingBottom: s(16),
        paddingHorizontal: s(16),
        flexDirection: 'row',
        alignItems: 'center',
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
            marginRight: s(12),
          }}
        >
          <ChevronLeft size={s(24)} color={theme.text} />
        </TouchableOpacity>
        
        <Text style={{
          flex: 1,
          color: theme.text,
          fontSize: s(17),
          fontWeight: '700',
          fontFamily: theme.fontFamilyBold,
        }}>
          Group Info
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: s(24) }}
      >
        {/* Group Photo */}
        <View style={{ alignItems: 'center', marginBottom: s(32) }}>
          <TouchableOpacity
            onPress={handleChangePhoto}
            disabled={uploading}
            style={{
              width: s(120),
              height: s(120),
              borderRadius: s(60),
              backgroundColor: theme.surfaceHighlight,
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
            }}
          >
            {uploading ? (
              <ActivityIndicator color={theme.primary} size="large" />
            ) : groupInfo?.avatar_url ? (
              <Image
                source={{ uri: groupInfo.avatar_url }}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <View style={{
                width: s(64),
                height: s(64),
                borderRadius: s(32),
                backgroundColor: theme.primary,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Users size={s(32)} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          
          <Text style={{
            marginTop: s(16),
            color: theme.text,
            fontSize: s(20),
            fontWeight: '700',
            fontFamily: theme.fontFamilyBold,
            textAlign: 'center',
          }}>
            {groupInfo?.name || 'Group Chat'}
          </Text>
          
          <Text style={{
            marginTop: s(6),
            color: theme.textMuted,
            fontSize: s(14),
            fontFamily: theme.fontFamily,
          }}>
            {members.length} members
          </Text>
          
          <Text style={{
            marginTop: s(4),
            color: theme.primary,
            fontSize: s(13),
            fontFamily: theme.fontFamilyMedium,
          }}>
          </Text>
        </View>

        {/* Members Section */}
        <View style={{
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#fff',
          borderRadius: s(16),
          marginBottom: s(12),
          borderWidth: 0.5,
          borderColor: theme.border,
          overflow: 'hidden',
        }}>
          {members.map((member, index) => (
            <View
              key={member.user_id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: s(12),
                paddingHorizontal: s(16),
                borderBottomWidth: index < members.length - 1 ? 0.5 : 0,
                borderBottomColor: theme.border,
              }}
            >
              <View style={{
                width: s(48),
                height: s(48),
                borderRadius: s(24),
                backgroundColor: theme.primary,
                overflow: 'hidden',
                marginRight: s(12),
              }}>
                {member.avatar_url ? (
                  <Image
                    source={{ uri: member.avatar_url }}
                    style={{ width: '100%', height: '100%' }}
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
                      fontSize: s(18),
                      fontWeight: '700',
                    }}>
                      {member.full_name?.[0]?.toUpperCase() || member.username?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: theme.text,
                  fontSize: s(16),
                  fontWeight: '600',
                  fontFamily: theme.fontFamilyMedium,
                }}>
                  {member.full_name || member.username}
                </Text>
                <Text style={{
                  color: theme.textMuted,
                  fontSize: s(13),
                  fontFamily: theme.fontFamily,
                }}>
                  @{member.username}
                </Text>
              </View>
              
              {member.user_id === groupInfo?.created_by && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.primaryLight,
                  paddingHorizontal: s(10),
                  paddingVertical: s(4),
                  borderRadius: s(12),
                }}>
                  <Crown size={s(12)} color={theme.primary} style={{ marginRight: s(4) }} />
                  <Text style={{
                    color: theme.primary,
                    fontSize: s(11),
                    fontWeight: '700',
                  }}>
                    Admin
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Leave Group Button - Matching Log Out style */}
        <TouchableOpacity
          onPress={handleLeaveGroup}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: s(16),
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: s(16),
            borderWidth: 0.5,
            borderColor: 'rgba(239, 68, 68, 0.3)',
            marginTop: s(40),
            marginBottom: s(20),
          }}
          activeOpacity={0.8}
        >
          <LogOut size={s(22)} color="#EF4444" />
          <Text style={{
            color: '#EF4444',
            fontSize: s(17),
            fontWeight: '700',
            fontFamily: theme.fontFamilyBold,
            marginLeft: s(10)
          }}>
            Leave Group
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
