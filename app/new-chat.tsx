import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  Platform,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { useContacts } from '../hooks/useContacts';
import { useConversations } from '../hooks/useConversations';
import { useGroups } from '../hooks/useGroups';
import * as ImagePicker from 'expo-image-picker';
import { 
  X, 
  Search, 
  Users, 
  Phone, 
  UserPlus, 
  ChevronLeft,
  MessageCircle,
  Plus,
  Check,
  ArrowRight,
  Camera
} from 'lucide-react-native';

interface SelectedContact {
  id: string;
  name: string;
  avatar_url?: string;
}

export default function NewChatScreen() {
  const router = useRouter();
  const { theme, isDark, scale } = useTheme();
  const { 
    contacts, 
    loading, 
    permissionGranted, 
    requestPermission, 
    syncContacts,
    loadContacts 
  } = useContacts();
  const { getOrCreateConversation } = useConversations();
  const { createGroup, uploadGroupAvatar } = useGroups();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<SelectedContact[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState<string | null>(null);
  const [showGroupDetails, setShowGroupDetails] = useState(false);

  const s = (size: number) => size * scale;

  useEffect(() => {
    checkPermissionAndLoad();
  }, []);

  const checkPermissionAndLoad = async () => {
    const hasPermission = await requestPermission();
    if (hasPermission) {
      await loadContacts();
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await syncContacts();
    setRefreshing(false);
  };

  const handleContactPress = async (contact: any) => {
    if (isGroupMode) {
      // Toggle selection in group mode
      const isSelected = selectedContacts.find(c => c.id === contact.id);
      if (isSelected) {
        setSelectedContacts(prev => prev.filter(c => c.id !== contact.id));
      } else {
        if (selectedContacts.length >= 50) {
          Alert.alert('Limit Reached', 'You can only add up to 50 members to a group');
          return;
        }
        setSelectedContacts(prev => [...prev, {
          id: contact.id,
          name: contact.name,
          avatar_url: contact.profile?.avatar_url
        }]);
      }
      return;
    }

    // Normal direct chat mode
    if (!contact.isAppUser) {
      Alert.alert(
        'Invite Friend',
        `${contact.name} is not on Olen yet. Would you like to invite them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Invite', 
            onPress: () => {
              Alert.alert('Coming Soon', 'Invite feature will be implemented soon!');
            }
          },
        ]
      );
      return;
    }

    try {
      const conversationId = await getOrCreateConversation(contact.id);
      router.replace(`/chat/${conversationId}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not start conversation');
    }
  };

  const handleCreateGroup = async () => {
    if (selectedContacts.length === 0) {
      Alert.alert('Error', 'Please select at least one member');
      return;
    }

    if (!showGroupDetails) {
      setShowGroupDetails(true);
      return;
    }

    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    let avatarUrl = null;
    if (groupImage) {
      const tempId = Date.now().toString();
      avatarUrl = await uploadGroupAvatar(groupImage, tempId);
    }

    const memberIds = selectedContacts.map(c => c.id);
    const conversationId = await createGroup(groupName.trim(), avatarUrl, memberIds);
    
    if (conversationId) {
      router.replace(`/chat/${conversationId}`);
    } else {
      Alert.alert('Error', 'Failed to create group. Please try again.');
    }
  };

  const pickImage = async () => {
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
      setGroupImage(result.assets[0].uri);
    }
  };

  const resetGroupMode = () => {
    if (showGroupDetails) {
      setShowGroupDetails(false);
    } else if (isGroupMode) {
      setIsGroupMode(false);
      setSelectedContacts([]);
    } else {
      router.back();
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phoneNumber.includes(searchQuery)
  );

  // Deduplicate contacts by phone number
  const uniqueContacts = filteredContacts.filter((contact, index, self) => 
    index === self.findIndex((c) => c.phoneNumber === contact.phoneNumber)
  );

  const appUsers = uniqueContacts.filter(c => c.isAppUser);
  const nonAppUsers = uniqueContacts.filter(c => !c.isAppUser);

  const canProceed = selectedContacts.length > 0;
  const canCreate = groupName.trim().length > 0;

  const ContactsSection = ({ children }: { children: React.ReactNode }) => (
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

  const ContactRow = ({ contact, isLast }: { contact: any; isLast: boolean }) => {
    const isSelected = selectedContacts.find(c => c.id === contact.id);
    
    return (
      <TouchableOpacity 
        style={{
          padding: s(16),
          flexDirection: 'row',
          alignItems: 'center',
          opacity: contact.isAppUser ? 1 : 0.7,
          borderBottomWidth: isLast ? 0 : 0.5,
          borderBottomColor: theme.border,
        }}
        onPress={() => handleContactPress(contact)}
        activeOpacity={0.7}
      >
        <View style={{
          width: s(48),
          height: s(48),
          borderRadius: s(24),
          marginRight: s(16),
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: contact.isAppUser ? theme.primary : theme.textMuted,
        }}>
          {contact.profile?.avatar_url ? (
            <Image 
              source={{ uri: contact.profile.avatar_url }}
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
                fontSize: s(16),
                fontWeight: '700',
              }}>
                {contact.name[0]?.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        
        <View style={{ flex: 1 }}>
          <Text style={{
            color: theme.text,
            fontSize: s(17),
            fontWeight: '600',
            marginBottom: s(2),
          }}>
            {contact.name}
          </Text>
          <Text style={{
            color: contact.isAppUser ? theme.primary : theme.textMuted,
            fontSize: s(14),
            fontWeight: contact.isAppUser ? '600' : '400',
          }}>
            {contact.isAppUser ? 'On Olen' : contact.phoneNumber}
          </Text>
        </View>

        {!isGroupMode && !contact.isAppUser && (
          <View style={{
            backgroundColor: theme.primaryLight,
            paddingHorizontal: s(16),
            paddingVertical: s(8),
            borderRadius: s(20),
            borderWidth: 0.5,
            borderColor: theme.border,
          }}>
            <Text style={{ 
              color: theme.primary, 
              fontSize: s(13), 
              fontWeight: '700' 
            }}>
              Invite
            </Text>
          </View>
        )}
        
        {/* Right side icon - transforms based on mode */}
        {contact.isAppUser && (
          <View style={{
            backgroundColor: isGroupMode 
              ? (isSelected ? theme.primary : theme.surfaceHighlight)
              : theme.primaryLight,
            width: s(36),
            height: s(36),
            borderRadius: s(18),
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            {isGroupMode ? (
              isSelected ? <Check size={s(20)} color="#fff" /> : <Plus size={s(20)} color={theme.textMuted} />
            ) : (
              <MessageCircle size={s(20)} color={theme.primary} />
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const SectionHeader = ({ title, count }: { title: string; count: number }) => (
    <View style={{ 
      marginTop: s(24), 
      marginBottom: s(12),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <Text style={{
        color: theme.primary,
        fontSize: s(13),
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}>
        {title}
      </Text>
      <View style={{
        backgroundColor: theme.primaryLight,
        paddingHorizontal: s(12),
        paddingVertical: s(4),
        borderRadius: s(12),
      }}>
        <Text style={{
          color: theme.primary,
          fontSize: s(12),
          fontWeight: '700',
        }}>
          {count}
        </Text>
      </View>
    </View>
  );

  if (!permissionGranted) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: theme.background, 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: s(24) 
      }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={{
          backgroundColor: theme.primaryLight,
          width: s(100),
          height: s(100),
          borderRadius: s(50),
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: s(24),
          borderWidth: 0.5,
          borderColor: theme.border,
        }}>
          <Users size={s(48)} color={theme.primary} />
        </View>
        <Text style={{
          color: theme.text,
          fontSize: s(22),
          fontWeight: '700',
          marginBottom: s(8),
          textAlign: 'center',
        }}>
          Access Your Contacts
        </Text>
        <Text style={{
          color: theme.textMuted,
          fontSize: s(16),
          textAlign: 'center',
          marginBottom: s(32),
          lineHeight: s(24),
        }}>
          Olen needs access to your contacts to show you who's already using the app
        </Text>
        <TouchableOpacity 
          style={{
            backgroundColor: theme.primary,
            paddingHorizontal: s(32),
            paddingVertical: s(16),
            borderRadius: s(16),
            width: '100%',
            alignItems: 'center',
          }}
          onPress={checkPermissionAndLoad}
        >
          <Text style={{
            color: '#fff',
            fontSize: s(17),
            fontWeight: '700',
          }}>
            Allow Access
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Group Details View
  if (showGroupDetails) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        
        {/* Clean Header - matching main view */}
        <View style={{
          backgroundColor: theme.background,
          paddingTop: Platform.OS === 'ios' ? s(60) : s(40),
          paddingBottom: s(20),
          paddingHorizontal: s(20),
        }}>
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
          }}>
            <TouchableOpacity 
              onPress={resetGroupMode}
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
            }}>
              New Group
            </Text>
            
            {canCreate ? (
              <TouchableOpacity 
                onPress={handleCreateGroup}
                style={{
                  width: s(40),
                  height: s(40),
                  borderRadius: s(20),
                  backgroundColor: theme.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Check size={s(22)} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: s(40) }} />
            )}
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: s(20) }}
        >
          {/* Group Photo */}
          <TouchableOpacity
            onPress={pickImage}
            style={{
              alignSelf: 'center',
              width: s(120),
              height: s(120),
              borderRadius: s(60),
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#fff',
              borderWidth: 0.5,
              borderColor: theme.border,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: s(24),
              overflow: 'hidden',
            }}
          >
            {groupImage ? (
              <Image
                source={{ uri: groupImage }}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <>
                <View style={{
                  width: s(52),
                  height: s(52),
                  borderRadius: s(26),
                  backgroundColor: theme.primaryLight,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: s(8),
                }}>
                  <Camera size={s(26)} color={theme.primary} />
                </View>
                <Text style={{
                  color: theme.textMuted,
                  fontSize: s(13),
                  fontWeight: '500',
                }}>
                  Add Photo
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Group Name Input - BlurView style matching search bar */}
          <View style={{ marginBottom: s(24) }}>
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
              <TextInput
                style={{
                  flex: 1,
                  color: theme.text,
                  fontSize: s(16),
                  marginLeft: s(16),
                  fontWeight: '500',
                }}
                placeholder="Group name..."
                placeholderTextColor={theme.textMuted}
                value={groupName}
                onChangeText={setGroupName}
                maxLength={50}
                autoFocus
              />
              <Text style={{
                color: theme.textMuted,
                fontSize: s(13),
                marginRight: s(16),
                fontWeight: '500',
              }}>
                {groupName.length}/50
              </Text>
            </View>
          </View>

          {/* Selected Members Section Header */}
          <View style={{ 
            marginTop: s(8),
            marginBottom: s(12),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Text style={{
              color: theme.primary,
              fontSize: s(13),
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              Members
            </Text>
            <Text style={{
              color: theme.textMuted,
              fontSize: s(13),
              fontWeight: '600',
            }}>
              {selectedContacts.length}
            </Text>
          </View>
          
          <ContactsSection>
            {selectedContacts.map((contact, index) => (
              <View 
                key={contact.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: s(16),
                  borderBottomWidth: index < selectedContacts.length - 1 ? 0.5 : 0,
                  borderBottomColor: theme.border,
                }}
              >
                <View style={{
                  width: s(44),
                  height: s(44),
                  borderRadius: s(22),
                  backgroundColor: theme.primary,
                  overflow: 'hidden',
                  marginRight: s(14),
                }}>
                  {contact.avatar_url ? (
                    <Image
                      source={{ uri: contact.avatar_url }}
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
                        fontSize: s(17),
                        fontWeight: '700',
                      }}>
                        {contact.name[0]?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{
                  color: theme.text,
                  fontSize: s(16),
                  fontWeight: '600',
                  flex: 1,
                }}>
                  {contact.name}
                </Text>
              </View>
            ))}
          </ContactsSection>
        </ScrollView>
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
          <TouchableOpacity 
            onPress={resetGroupMode}
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
          }}>
            {isGroupMode ? 'New Group' : 'New Chat'}
          </Text>
          
          {isGroupMode && canProceed ? (
            <TouchableOpacity 
              onPress={handleCreateGroup}
              style={{
                width: s(40),
                height: s(40),
                borderRadius: s(20),
                backgroundColor: theme.primary,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <ArrowRight size={s(22)} color="#fff" />
            </TouchableOpacity>
          ) : isGroupMode ? (
            <TouchableOpacity 
              onPress={resetGroupMode}
              style={{
                width: s(40),
                height: s(40),
                borderRadius: s(20),
                backgroundColor: theme.surfaceHighlight,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <X size={s(24)} color={theme.text} />
            </TouchableOpacity>
          ) : (
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
              <X size={s(24)} color={theme.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Selected Count in Group Mode */}
        {isGroupMode && (
          <Text style={{
            color: theme.textMuted,
            fontSize: s(14),
            marginBottom: s(12),
            fontFamily: theme.fontFamilyMedium,
          }}>
            {selectedContacts.length > 0 
              ? `${selectedContacts.length} member${selectedContacts.length > 1 ? 's' : ''} selected`
              : 'Select at least one contact'
            }
          </Text>
        )}

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
              placeholder={isGroupMode ? "Search contacts..." : "Search contacts..."}
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

      {/* Quick Actions - Hide in Group Mode */}
      {!isGroupMode && (
        <View style={{
          paddingHorizontal: s(20),
          paddingVertical: s(20),
          flexDirection: 'row',
          gap: s(12),
        }}>
          <TouchableOpacity 
            style={{
              flex: 1,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#fff',
              borderRadius: s(16),
              padding: s(16),
              borderWidth: 0.5,
              borderColor: theme.border,
              alignItems: 'center',
            }}
            onPress={() => setIsGroupMode(true)}
          >
            <View style={{
              backgroundColor: theme.primary,
              width: s(52),
              height: s(52),
              borderRadius: s(26),
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: s(12),
            }}>
              <Users size={s(26)} color="#fff" />
            </View>
            <Text style={{
              color: theme.text,
              fontSize: s(15),
              fontWeight: '700',
            }}>
              New Group
            </Text>
            <Text style={{
              color: theme.textMuted,
              fontSize: s(12),
              marginTop: s(4),
            }}>
              Create a group
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={{
              flex: 1,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#fff',
              borderRadius: s(16),
              padding: s(16),
              borderWidth: 0.5,
              borderColor: theme.border,
              alignItems: 'center',
            }}
            onPress={() => {}}
          >
            <View style={{
              backgroundColor: '#10B981',
              width: s(52),
              height: s(52),
              borderRadius: s(26),
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: s(12),
            }}>
              <UserPlus size={s(26)} color="#fff" />
            </View>
            <Text style={{
              color: theme.text,
              fontSize: s(15),
              fontWeight: '700',
            }}>
              Add Contact
            </Text>
            <Text style={{
              color: theme.textMuted,
              fontSize: s(12),
              marginTop: s(4),
            }}>
              Save to phone
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contacts List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          padding: s(20),
          paddingTop: 0,
          paddingBottom: s(40),
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* App Users Section */}
        {appUsers.length > 0 && (
          <>
            <SectionHeader title={isGroupMode ? "Contacts on Olen" : "Contacts on Olen"} count={appUsers.length} />
            <ContactsSection>
              {appUsers.map((contact, index) => (
                <ContactRow 
                  key={contact.phoneNumber} 
                  contact={contact} 
                  isLast={index === appUsers.length - 1} 
                />
              ))}
            </ContactsSection>
          </>
        )}
        
        {/* Non-App Users Section - Hide in Group Mode */}
        {!isGroupMode && nonAppUsers.length > 0 && (
          <>
            <SectionHeader title="Invite to Olen" count={nonAppUsers.length} />
            <ContactsSection>
              {nonAppUsers.map((contact, index) => (
                <ContactRow 
                  key={contact.phoneNumber} 
                  contact={contact} 
                  isLast={index === nonAppUsers.length - 1} 
                />
              ))}
            </ContactsSection>
          </>
        )}
        
        {/* Empty State */}
        {nonAppUsers.length === 0 && appUsers.length === 0 && !loading && (
          <View style={{ 
            padding: s(40), 
            alignItems: 'center',
            marginTop: s(40),
          }}>
            <View style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.03)',
              width: s(80),
              height: s(80),
              borderRadius: s(40),
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: s(16),
            }}>
              <Search size={s(40)} color={theme.textMuted} />
            </View>
            <Text style={{
              color: theme.textMuted,
              fontSize: s(16),
              marginBottom: s(8),
              fontWeight: '500',
            }}>
              No contacts found
            </Text>
            <TouchableOpacity 
              style={{
                marginTop: s(8),
                backgroundColor: theme.primaryLight,
                paddingHorizontal: s(20),
                paddingVertical: s(10),
                borderRadius: s(12),
              }}
              onPress={syncContacts}
            >
              <Text style={{
                color: theme.primary,
                fontWeight: '700',
                fontSize: s(15),
              }}>
                Sync Contacts
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
