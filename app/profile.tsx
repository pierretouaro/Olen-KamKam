import { useRouter } from 'expo-router';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  Image,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useTheme, Theme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { 
  ChevronLeft, 
  Camera,
  User,
  AtSign,
  Phone,
  FileText,
  Check,
  X,
  Trash2
} from 'lucide-react-native';

// ProfileField component - defined OUTSIDE the main component to prevent re-creation on renders
interface ProfileFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder: string;
  editable?: boolean;
  multiline?: boolean;
  isLast?: boolean;
  onChangeText?: (text: string) => void;
  displayValue?: string;
  isEditing: boolean;
  theme: Theme;
  scale: number;
}

const ProfileField = ({ 
  icon, 
  label, 
  value, 
  placeholder,
  editable = false,
  multiline = false,
  isLast = false,
  onChangeText,
  displayValue,
  isEditing,
  theme,
  scale,
}: ProfileFieldProps) => (
  <View style={{
    flexDirection: 'row',
    alignItems: multiline ? 'flex-start' : 'center',
    padding: 16 * scale,
    borderBottomWidth: isLast ? 0 : 0.5,
    borderBottomColor: theme.border,
  }}>
    <View style={{
      backgroundColor: theme.primaryLight,
      width: 44 * scale,
      height: 44 * scale,
      borderRadius: 12 * scale,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16 * scale,
    }}>
      {icon}
    </View>
    
    <View style={{ flex: 1 }}>
      <Text style={{
        color: theme.textMuted,
        fontSize: 13 * scale,
        fontFamily: theme.fontFamilyMedium,
        marginBottom: 4 * scale,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {label}
      </Text>
      {isEditing && editable ? (
        <TextInput
          style={{
            color: theme.text,
            fontSize: 16 * scale,
            fontFamily: theme.fontFamily,
            padding: 0,
            paddingVertical: multiline ? 8 * scale : 0,
            borderBottomWidth: 1,
            borderBottomColor: theme.primary,
          }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          maxLength={multiline ? 160 : 30}
        />
      ) : (
        <Text style={{
          color: displayValue || value ? theme.text : theme.textMuted,
          fontSize: 16 * scale,
          fontFamily: theme.fontFamily,
          lineHeight: multiline ? 22 * scale : undefined,
        }}>
          {displayValue || value || placeholder}
        </Text>
      )}
    </View>
    
    {!isEditing && editable && (
      <Text style={{
        color: theme.primary,
        fontSize: 12 * scale,
        fontFamily: theme.fontFamilyMedium,
      }}>
        Editable
      </Text>
    )}
  </View>
);

// ProfileMenuSection component - also defined outside
interface ProfileMenuSectionProps {
  children: React.ReactNode;
  theme: Theme;
  scale: number;
}

const ProfileMenuSection = ({ children, theme, scale }: ProfileMenuSectionProps) => (
  <View style={{
    backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.03)' : '#fff',
    borderRadius: 16 * scale,
    marginBottom: 12 * scale,
    borderWidth: 0.5,
    borderColor: theme.border,
    overflow: 'hidden',
  }}>
    {children}
  </View>
);

export default function ProfileScreen() {
  const router = useRouter();
  const { theme, isDark, scale } = useTheme();
  const { user, profile, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(profile?.bio || '');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);

  const s = (size: number) => size * scale;

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || '');
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    
    const trimmedUsername = username.trim().toLowerCase();
    
    if (!trimmedUsername) {
      Alert.alert('Error', 'Username is required');
      setSaving(false);
      return;
    }
    
    if (trimmedUsername !== profile?.username) {
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmedUsername)
        .single();
      
      if (existingUser) {
        Alert.alert('Error', 'Username is already taken');
        setSaving(false);
        return;
      }
    }
    
    try {
      await updateProfile({
        bio: bio.trim(),
        full_name: fullName.trim(),
        username: trimmedUsername,
      });
      
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setBio(profile?.bio || '');
    setFullName(profile?.full_name || '');
    setUsername(profile?.username || '');
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload a photo');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;
    setUploadingImage(true);

    try {
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 600 } }],
        { 
          compress: 0.8, 
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        }
      );

      if (!manipulatedImage.base64) {
        throw new Error('Failed to convert image');
      }

      const binaryString = atob(manipulatedImage.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const fileName = `${user.id}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, bytes, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      await updateProfile({ avatar_url: publicUrl });
      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', 'Failed to upload avatar');
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteAvatar = async () => {
    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture? This will show your initial instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploadingImage(true);
              
              if (avatarUrl) {
                const fileName = avatarUrl.split('/').pop();
                if (fileName) {
                  await supabase.storage
                    .from('avatars')
                    .remove([`avatars/${fileName}`]);
                }
              }
              
              await updateProfile({ avatar_url: null });
              setAvatarUrl(null);
            } catch (error) {
              console.error('Error deleting avatar:', error);
              Alert.alert('Error', 'Failed to remove profile picture');
            } finally {
              setUploadingImage(false);
            }
          }
        }
      ]
    );
  };

  const getInitial = () => {
    const name = profile?.full_name || profile?.username || 'U';
    return name[0]?.toUpperCase();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{
        paddingTop: insets.top + 10 * scale,
        paddingBottom: 10 * scale,
        paddingHorizontal: 20 * scale,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 0.5,
        borderBottomColor: theme.border,
      }}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={{
            width: 40 * scale,
            height: 40 * scale,
            borderRadius: 20 * scale,
            backgroundColor: theme.surfaceHighlight,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={24 * scale} color={theme.text} />
        </TouchableOpacity>

        <Text style={{ 
          color: theme.text, 
          fontSize: 20 * scale, 
          fontWeight: '700',
          fontFamily: theme.fontFamilyBold,
        }}>
          Profile
        </Text>

        {isEditing ? (
          <View style={{ flexDirection: 'row', gap: 8 * scale }}>
            <TouchableOpacity 
              onPress={cancelEditing}
              style={{
                width: 40 * scale,
                height: 40 * scale,
                borderRadius: 20 * scale,
                backgroundColor: theme.surfaceHighlight,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <X size={22 * scale} color={theme.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleSave}
              style={{
                width: 40 * scale,
                height: 40 * scale,
                borderRadius: 20 * scale,
                backgroundColor: theme.primary,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Check size={22 * scale} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            onPress={() => setIsEditing(true)}
            style={{
              paddingHorizontal: 16 * scale,
              paddingVertical: 8 * scale,
              borderRadius: 20 * scale,
              backgroundColor: theme.primaryLight,
            }}
          >
            <Text style={{
              color: theme.primary,
              fontSize: 15 * scale,
              fontWeight: '600',
              fontFamily: theme.fontFamilyMedium,
            }}>
              Edit
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          padding: 20 * scale, 
          paddingBottom: 100 * scale 
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 32 * scale }}>
          <View style={{
            position: 'relative',
            marginBottom: 16 * scale,
          }}>
            {avatarUrl ? (
              <Image
                key={avatarUrl}
                source={{ uri: avatarUrl, cache: 'reload' }}
                style={{
                  width: 120 * scale,
                  height: 120 * scale,
                  borderRadius: 60 * scale,
                  borderWidth: 4,
                  borderColor: theme.primaryLight,
                }}
              />
            ) : (
              <View style={{
                backgroundColor: theme.primary,
                width: 120 * scale,
                height: 120 * scale,
                borderRadius: 60 * scale,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 4,
                borderColor: theme.primaryLight,
              }}>
                <Text style={{ 
                  fontSize: 48 * scale, 
                  color: '#fff', 
                  fontWeight: '700',
                  fontFamily: theme.fontFamilyBold,
                }}>
                  {getInitial()}
                </Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: theme.primary,
                width: 40 * scale,
                height: 40 * scale,
                borderRadius: 20 * scale,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 3,
                borderColor: theme.background,
              }}
              onPress={pickImage}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Camera size={20 * scale} color="#fff" />
              )}
            </TouchableOpacity>
            
            {avatarUrl && (
              <TouchableOpacity 
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  backgroundColor: '#EF4444',
                  width: 36 * scale,
                  height: 36 * scale,
                  borderRadius: 18 * scale,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 3,
                  borderColor: theme.background,
                }}
                onPress={deleteAvatar}
                disabled={uploadingImage}
              >
                <Trash2 size={16 * scale} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={{
            color: theme.text,
            fontSize: 24 * scale,
            fontWeight: '700',
            fontFamily: theme.fontFamilyBold,
            marginBottom: 4 * scale,
          }}>
            {profile?.full_name || 'Loading...'}
          </Text>

          <Text style={{
            color: theme.textMuted,
            fontSize: 16 * scale,
            fontFamily: theme.fontFamily,
          }}>
            @{profile?.username || 'username'}
          </Text>
        </View>

        <ProfileMenuSection theme={{...theme, isDark}} scale={scale}>
          <ProfileField
            icon={<User size={22 * scale} color={theme.primary} />}
            label="Full Name"
            value={fullName}
            placeholder="Enter your full name"
            editable
            isEditing={isEditing}
            onChangeText={setFullName}
            theme={{...theme, isDark}}
            scale={scale}
          />
          <ProfileField
            icon={<AtSign size={22 * scale} color={theme.primary} />}
            label="Username"
            value={username}
            placeholder="Enter username"
            editable
            isEditing={isEditing}
            onChangeText={setUsername}
            theme={{...theme, isDark}}
            scale={scale}
          />
          <ProfileField
            icon={<Phone size={22 * scale} color={theme.primary} />}
            label="Phone Number"
            value={profile?.phone_number || ''}
            placeholder="No phone number"
            isEditing={false}
            theme={{...theme, isDark}}
            scale={scale}
          />
          <ProfileField
            icon={<FileText size={22 * scale} color={theme.primary} />}
            label="Bio"
            value={bio}
            placeholder="Add a bio..."
            editable
            multiline
            isLast
            isEditing={isEditing}
            onChangeText={setBio}
            theme={{...theme, isDark}}
            scale={scale}
          />
        </ProfileMenuSection>
      </ScrollView>
    </View>
  );
}
