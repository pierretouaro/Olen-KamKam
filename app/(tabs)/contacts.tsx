import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Image, // Added Image import
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';
import { 
  Search, 
  Phone, 
  Video, 
  X, 
  ChevronLeft,
  MessageCircle,
  UserPlus,
  Users,
  MoreHorizontal
} from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import { useContacts } from '../../hooks/useContacts';
import { useConversations } from '../../hooks/useConversations';

export default function ContactsScreen() {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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
    if (!contact.isAppUser) return;
    
    try {
      const conversationId = await getOrCreateConversation(contact.id);
      router.push(`/chat/${conversationId}` as any);
    } catch (error: any) {
      console.error('Error starting conversation:', error);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phoneNumber.includes(searchQuery)
  );

  const appUsers = filteredContacts.filter(c => c.isAppUser);
  const nonAppUsers = filteredContacts.filter(c => !c.isAppUser);

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

  const ContactRow = ({ contact, isLast }: { contact: any; isLast: boolean }) => (
    <Animated.View entering={FadeInUp.duration(300).delay(0)}>
      <TouchableOpacity 
        style={{
          padding: s(16),
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: isLast ? 0 : 0.5,
          borderBottomColor: theme.border,
        }}
        onPress={() => handleContactPress(contact)}
        activeOpacity={0.7}
      >
        <View style={{
          width: s(52),
          height: s(52),
          borderRadius: s(26),
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
                fontSize: s(18),
                fontWeight: '700',
                fontFamily: theme.fontFamilyBold,
              }}>
                {contact.name.charAt(0)}
              </Text>
            </View>
          )}
        </View>
        
        <View style={{ flex: 1 }}>
          <Text style={{
            color: theme.text,
            fontSize: s(17),
            fontWeight: '600',
            fontFamily: theme.fontFamilyMedium,
            marginBottom: s(4),
          }}>
            {contact.name}
          </Text>
          <Text style={{
            color: contact.isAppUser ? theme.primary : theme.textMuted,
            fontSize: s(14),
            fontWeight: contact.isAppUser ? '600' : '400',
            fontFamily: contact.isAppUser ? theme.fontFamilyMedium : theme.fontFamily,
          }}>
            {contact.isAppUser ? 'On Olen' : contact.phoneNumber}
          </Text>
        </View>
        
        {contact.isAppUser ? (
          <View style={{ flexDirection: 'row', gap: s(8) }}>
            <TouchableOpacity 
              style={{
                backgroundColor: theme.primaryLight,
                width: s(44),
                height: s(44),
                borderRadius: s(22),
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 0.5,
                borderColor: theme.border,
              }}
              onPress={() => handleContactPress(contact)}
            >
              <MessageCircle size={s(22)} color={theme.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={{
              backgroundColor: theme.primaryLight,
              paddingHorizontal: s(16),
              paddingVertical: s(8),
              borderRadius: s(20),
              borderWidth: 0.5,
              borderColor: theme.border,
            }}
          >
            <Text style={{ 
              color: theme.primary, 
              fontSize: s(13), 
              fontWeight: '700',
            }}>
              Invite
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

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
        fontFamily: theme.fontFamilyBold,
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
        borderWidth: 0.5,
        borderColor: theme.border,
      }}>
        <Text style={{
          color: theme.primary,
          fontSize: s(12),
          fontWeight: '700',
          fontFamily: theme.fontFamilyBold,
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
          fontFamily: theme.fontFamilyBold,
          marginBottom: s(8),
          textAlign: 'center',
        }}>
          Access Your Contacts
        </Text>
        <Text style={{
          color: theme.textMuted,
          fontSize: s(16),
          fontFamily: theme.fontFamily,
          textAlign: 'center',
          marginBottom: s(32),
          lineHeight: s(24),
        }}>
          We need access to your contacts to show you who's already using Olen
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
            fontFamily: theme.fontFamilyBold,
          }}>
            Allow Access
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && contacts.length === 0) {
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
            fontSize: s(28),
            fontWeight: '700',
            fontFamily: theme.fontFamilyBold,
          }}>
            Friends
          </Text>
          
          <View style={{ width: s(40) }} />
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
              placeholder="Search friends..."
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

      {/* Friends List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          padding: s(20),
          paddingBottom: s(100),
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* App Users Section */}
        {appUsers.length > 0 && (
          <>
            <SectionHeader title="Friends on Olen" count={appUsers.length} />
            <ContactsSection>
              {appUsers.map((contact, index) => (
                <ContactRow 
                  key={contact.id || contact.phoneNumber} 
                  contact={contact} 
                  isLast={index === appUsers.length - 1} 
                />
              ))}
            </ContactsSection>
          </>
        )}
        
        {/* Non-App Users Section */}
        {nonAppUsers.length > 0 && (
          <>
            <SectionHeader title="Contacts" count={nonAppUsers.length} />
            <ContactsSection>
              {nonAppUsers.map((contact, index) => (
                <ContactRow 
                  key={contact.id || contact.phoneNumber} 
                  contact={contact} 
                  isLast={index === nonAppUsers.length - 1} 
                />
              ))}
            </ContactsSection>
          </>
        )}
        
        {/* Empty State */}
        {appUsers.length === 0 && nonAppUsers.length === 0 && !loading && (
          <View style={{ 
            padding: s(40), 
            alignItems: 'center',
            marginTop: s(60),
          }}>
            <View style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.03)',
              width: s(80),
              height: s(80),
              borderRadius: s(40),
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: s(16),
              borderWidth: 0.5,
              borderColor: theme.border,
            }}>
              <Users size={s(40)} color={theme.textMuted} />
            </View>
            <Text style={{
              color: theme.textMuted,
              fontSize: s(16),
              fontFamily: theme.fontFamilyMedium,
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
                borderWidth: 0.5,
                borderColor: theme.border,
              }}
              onPress={syncContacts}
            >
              <Text style={{
                color: theme.primary,
                fontWeight: '700',
                fontFamily: theme.fontFamilyBold,
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