import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Switch, 
  ScrollView, 
  Modal, 
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useHaptics } from '../../hooks/useHaptics';
import { usePrivacy } from '../../hooks/usePrivacy';
import { useDataSaver } from '../../hooks/useDataSaver';
import { useSectionFilter } from '../../context/SectionFilterContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Moon, 
  Sun, 
  ChevronRight, 
  Bell, 
  Lock, 
  User, 
  Shield,
  Type,
  LogOut,
  ChevronLeft,
  Globe,
  Database,
  MessageSquare,
  Eye,
  Smartphone,
  Wifi,
  WifiOff,
  Check,
  X,
  Trash2,
  Palette,
  Filter,
} from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut, profile, user } = useAuth();
  
  const handleLogout = async () => {
    trigger('heavy');
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const { theme, isDark, themeColor, scale, toggleTheme, setThemeColor, setScale } = useTheme();
  const { trigger } = useHaptics();
  const { settings, updateSetting } = usePrivacy();
  const { dataSaverEnabled, toggleDataSaver } = useDataSaver();
  const { sectionFilterEnabled, toggleSectionFilter } = useSectionFilter();
  const [storageUsage, setStorageUsage] = useState('0 MB');
  const [messageCount, setMessageCount] = useState(0);

  const s = (size: number) => size * scale;

  useEffect(() => {
    calculateStorage();
    countMessages();
  }, []);

  const calculateStorage = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length * 2;
        }
      }
      const mb = (totalSize / 1024 / 1024).toFixed(2);
      setStorageUsage(`${mb} MB`);
    } catch (e) {
      console.error(e);
    }
  };

  const countMessages = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const messageKeys = keys.filter(k => k.startsWith('chat_') && k.endsWith('_messages'));
      let count = 0;
      for (const key of messageKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const messages = JSON.parse(data);
          count += messages.length;
        }
      }
      setMessageCount(count);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAllData = async () => {
    trigger('heavy');
    await AsyncStorage.clear();
    calculateStorage();
    countMessages();
    trigger('success');
  };

  const SettingItem = ({
    icon,
    label,
    description,
    value,
    hasSwitch,
    switchValue,
    onSwitchChange,
    onPress,
    danger,
    showArrow = true,
    isLast = false
  }: {
    icon: React.ReactNode;
    label: string;
    description?: string;
    value?: string | React.ReactNode;
    hasSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
    onPress?: () => void;
    danger?: boolean;
    showArrow?: boolean;
    isLast?: boolean;
  }) => (
    <TouchableOpacity 
      style={{
        backgroundColor: 'transparent',
        padding: s(16),
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: theme.border,
      }}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={hasSwitch}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{
          backgroundColor: danger 
            ? 'rgba(239, 68, 68, 0.1)' 
            : theme.primaryLight,
          width: s(44),
          height: s(44),
          borderRadius: s(12),
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: s(12),
        }}>
          {icon}
        </View>
        
        <View style={{ flex: 1 }}>
          <Text style={{ 
            color: danger ? '#EF4444' : theme.text, 
            fontSize: s(16),
            fontWeight: '600',
            fontFamily: theme.fontFamilyMedium,
            marginBottom: description ? s(4) : 0,
          }}>
            {label}
          </Text>
          
          {description && (
            <Text style={{
              color: theme.textMuted,
              fontSize: s(13),
              fontFamily: theme.fontFamily,
              lineHeight: s(18),
              maxWidth: '95%'
            }}>
              {description}
            </Text>
          )}
        </View>

        {hasSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={(val) => {
              trigger('light');
              onSwitchChange?.(val);
            }}
            trackColor={{ false: isDark ? '#374151' : '#D1D5DB', true: theme.primary }}
            thumbColor="#fff"
            ios_backgroundColor={isDark ? '#374151' : '#D1D5DB'}
          />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {value && (
              typeof value === 'string' ? (
                <Text style={{ 
                  color: theme.textMuted, 
                  fontSize: s(15),
                  marginRight: s(8),
                  fontWeight: '500',
                  fontFamily: theme.fontFamilyMedium,
                }}>
                  {value}
                </Text>
              ) : (
                <View style={{ marginRight: s(8) }}>
                  {value}
                </View>
              )
            )}
            {showArrow && (
              <ChevronRight size={s(20)} color={theme.textMuted} />
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <View style={{ marginBottom: s(12), marginTop: s(24) }}>
      <Text style={{ 
        color: theme.primary, 
        fontSize: s(13), 
        fontWeight: '700',
        fontFamily: theme.fontFamilyBold,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: subtitle ? s(4) : 0
      }}>
        {title}
      </Text>
      {subtitle && (
        <Text style={{
          color: theme.textMuted,
          fontSize: s(13),
          fontFamily: theme.fontFamily,
        }}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  const SettingsSection = ({ children }: { children: React.ReactNode }) => (
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

  const getInitial = () => {
    const name = profile?.full_name || profile?.username || 'U';
    return name[0]?.toUpperCase();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={{
        backgroundColor: theme.background,
        paddingTop: Platform.OS === 'ios' ? s(60) : s(40),
        paddingBottom: s(20),
        paddingHorizontal: s(20),
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(20) }}>
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
            marginLeft: s(16)
          }}>
            Settings
          </Text>
        </View>

        <TouchableOpacity 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#fff',
            borderRadius: s(16),
            padding: s(16),
            borderWidth: 0.5,
            borderColor: theme.border,
          }}
          onPress={() => router.push('/profile')}
          activeOpacity={0.8}
        >
          <View style={{
            width: s(60),
            height: s(60),
            borderRadius: s(30),
            overflow: 'hidden',
            backgroundColor: theme.primary,
            marginRight: s(16),
            borderWidth: 3,
            borderColor: theme.primaryLight,
          }}>
            {profile?.avatar_url ? (
              <Image 
                source={{ uri: profile.avatar_url, cache: 'reload' }}
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
                  fontSize: s(22),
                  fontWeight: '700',
                  fontFamily: theme.fontFamilyBold,
                }}>
                  {getInitial()}
                </Text>
              </View>
            )}
          </View>
          
          <View style={{ flex: 1 }}>
            <Text style={{
              color: theme.text,
              fontSize: s(18),
              fontWeight: '700',
              fontFamily: theme.fontFamilyBold,
              marginBottom: s(4),
            }}>
              {profile?.full_name || 'Loading...'}
            </Text>
            <Text style={{
              color: theme.textMuted,
              fontSize: s(15),
              fontFamily: theme.fontFamily,
            }}>
              @{profile?.username || 'username'}
            </Text>
          </View>
          
          <ChevronRight size={s(24)} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ 
          padding: s(20), 
          paddingBottom: s(100) 
        }}
      >
        <SectionHeader title="Appearance" subtitle="Customize how Olen looks" />
        
        <SettingsSection>
          <SettingItem
            icon={isDark ? <Sun size={s(22)} color={theme.primary} /> : <Moon size={s(22)} color={theme.primary} />}
            label="Dark Mode"
            description="Use a darker color scheme that's easier on the eyes in low light"
            hasSwitch
            switchValue={isDark}
            onSwitchChange={toggleTheme}
          />

          <View style={{
            padding: s(16),
            borderTopWidth: 0.5,
            borderTopColor: theme.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(16) }}>
              <View style={{
                backgroundColor: theme.primaryLight,
                width: s(44),
                height: s(44),
                borderRadius: s(12),
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: s(12),
              }}>
                <Palette size={s(22)} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: s(16), fontWeight: '600', fontFamily: theme.fontFamilyMedium }}>
                  Theme Color
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: s(13), marginTop: s(2), fontFamily: theme.fontFamily }}>
                  Choose your preferred accent color
                </Text>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', gap: s(12) }}>
              <TouchableOpacity
                onPress={() => {
                  setThemeColor('periwinkle');
                  trigger('light');
                }}
                style={{
                  flex: 1,
                  padding: s(12),
                  borderRadius: s(16),
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F9FF',
                  borderWidth: 2,
                  borderColor: themeColor === 'periwinkle' ? '#8B9EFF' : theme.border,
                  alignItems: 'center',
                }}
              >
                <View style={{
                  width: s(48),
                  height: s(48),
                  borderRadius: s(24),
                  backgroundColor: '#8B9EFF',
                  marginBottom: s(8),
                  shadowColor: '#8B9EFF',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }} />
                <Text style={{
                  color: theme.text,
                  fontSize: s(14),
                  fontWeight: themeColor === 'periwinkle' ? '700' : '500',
                  fontFamily: themeColor === 'periwinkle' ? theme.fontFamilyBold : theme.fontFamilyMedium,
                }}>
                  Periwinkle
                </Text>
                {themeColor === 'periwinkle' && (
                  <View style={{
                    position: 'absolute',
                    top: s(8),
                    right: s(8),
                    width: s(20),
                    height: s(20),
                    borderRadius: s(10),
                    backgroundColor: '#8B9EFF',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Check size={s(12)} color="#fff" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setThemeColor('green');
                  trigger('light');
                }}
                style={{
                  flex: 1,
                  padding: s(12),
                  borderRadius: s(16),
                  backgroundColor: isDark ? 'rgba(27, 77, 62, 0.15)' : '#F0F5F2',
                  borderWidth: 2,
                  borderColor: themeColor === 'green' ? '#1B4D3E' : theme.border,
                  alignItems: 'center',
                }}
              >
                <View style={{
                  width: s(48),
                  height: s(48),
                  borderRadius: s(24),
                  backgroundColor: '#1B4D3E',
                  marginBottom: s(8),
                  shadowColor: '#1B4D3E',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }} />
                <Text style={{
                  color: theme.text,
                  fontSize: s(14),
                  fontWeight: themeColor === 'green' ? '700' : '500',
                  fontFamily: themeColor === 'green' ? theme.fontFamilyBold : theme.fontFamilyMedium,
                }}>
                  Green
                </Text>
                {themeColor === 'green' && (
                  <View style={{
                    position: 'absolute',
                    top: s(8),
                    right: s(8),
                    width: s(20),
                    height: s(20),
                    borderRadius: s(10),
                    backgroundColor: '#1B4D3E',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Check size={s(12)} color="#fff" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={{
            padding: s(16),
            borderTopWidth: 0.5,
            borderTopColor: theme.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(12) }}>
              <View style={{
                backgroundColor: theme.primaryLight,
                width: s(44),
                height: s(44),
                borderRadius: s(12),
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: s(12),
              }}>
                <Type size={s(22)} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: s(16), fontWeight: '600', fontFamily: theme.fontFamilyMedium }}>
                  Text Size
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: s(13), marginTop: s(2), fontFamily: theme.fontFamily }}>
                  Adjust the size of text throughout the app
                </Text>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: s(8) }}>
            {[0.81, 0.855, 0.9, 0.945, 0.99].map((preset, index) => {
              const displayLabels = ['90%', '95%', '100%', '105%', '110%'];
              return (
                <TouchableOpacity
                  key={preset}
                  onPress={() => {
                    setScale(preset);
                    trigger('light');
                  }}
                  style={{
                    flex: 1,
                    marginHorizontal: s(4),
                    paddingVertical: s(12),
                    borderRadius: s(12),
                    backgroundColor: scale === preset ? theme.primary : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    alignItems: 'center',
                    borderWidth: scale === preset ? 0 : 1,
                    borderColor: theme.border,
                  }}
                >
                  <Text style={{
                    color: scale === preset ? '#fff' : theme.text,
                    fontSize: s(14),
                    fontWeight: scale === preset ? '700' : '600',
                    fontFamily: scale === preset ? theme.fontFamilyBold : theme.fontFamilyMedium,
                  }}>
                    {displayLabels[index]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          </View>
        </SettingsSection>

        <SectionHeader title="Privacy" subtitle="Control who can see your activity" />
        
        <SettingsSection>
          <SettingItem
            icon={<Eye size={s(22)} color={theme.primary} />}
            label="Read Receipts"
            description="Let others know when you've read their messages"
            hasSwitch
            switchValue={settings.readReceipts}
            onSwitchChange={(v) => updateSetting('readReceipts', v)}
          />
          
          <SettingItem
            icon={<Smartphone size={s(22)} color={theme.primary} />}
            label="Online Status"
            description="Show when you're active and using the app"
            hasSwitch
            switchValue={settings.onlineStatus}
            onSwitchChange={(v) => updateSetting('onlineStatus', v)}
          />
          
          <SettingItem
            icon={<MessageSquare size={s(22)} color={theme.primary} />}
            label="Typing Indicators"
            description="Show others when you're typing a message"
            hasSwitch
            switchValue={settings.typingIndicators}
            onSwitchChange={(v) => updateSetting('typingIndicators', v)}
          />
          
          <SettingItem
            icon={<Lock size={s(22)} color={theme.primary} />}
            label="Last Seen"
            description="Show when you were last active in the app"
            hasSwitch
            switchValue={settings.lastSeen}
            onSwitchChange={(v) => updateSetting('lastSeen', v)}
            isLast
          />
        </SettingsSection>

        <SectionHeader title="Preferences" subtitle="App behavior and notifications" />
        
        <SettingsSection>
          <SettingItem
            icon={<Bell size={s(22)} color={theme.primary} />}
            label="Notifications"
            description="Get notified about new messages and updates"
            value="On"
            onPress={() => {}}
          />
          
          <SettingItem
            icon={dataSaverEnabled ? <WifiOff size={s(22)} color={theme.primary} /> : <Wifi size={s(22)} color={theme.primary} />}
            label="Data Saver"
            description="Reduce data usage by loading lower quality media"
            hasSwitch
            switchValue={dataSaverEnabled}
            onSwitchChange={toggleDataSaver}
          />
          
          <SettingItem
            icon={<Filter size={s(22)} color={theme.primary} />}
            label="Section Filter"
            description="Show filter tabs (All/Contacts/Groups/Unread) on homepage"
            hasSwitch
            switchValue={sectionFilterEnabled}
            onSwitchChange={toggleSectionFilter}
            isLast
          />
        </SettingsSection>

        <SectionHeader title="Storage & Data" subtitle="Manage your device's storage" />
        
        <SettingsSection>
          <SettingItem
            icon={<Database size={s(22)} color={theme.primary} />}
            label="Storage Usage"
            description="Amount of space Olen is using on your device"
            value={storageUsage}
            showArrow={false}
          />
          
          <SettingItem
            icon={<MessageSquare size={s(22)} color={theme.primary} />}
            label="Cached Messages"
            description="Number of messages stored locally for offline use"
            value={`${messageCount} messages`}
            showArrow={false}
          />
          
          <SettingItem
            icon={<Trash2 size={s(22)} color="#EF4444" />}
            label="Clear All Data"
            description="Delete all local data and cached conversations immediately"
            danger
            onPress={handleClearAllData}
            isLast
          />
        </SettingsSection>

        <SectionHeader title="Support" subtitle="Get help and learn more" />
        
        <SettingsSection>
          <SettingItem
            icon={<Shield size={s(22)} color={theme.primary} />}
            label="About Olen"
            description="Version information and legal details"
            value="v0.9.0"
            onPress={() => {}}
            isLast
          />
        </SettingsSection>

        <TouchableOpacity 
          style={{
            marginTop: s(40),
            marginBottom: s(20),
            alignSelf: 'center',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: s(999),
            paddingVertical: s(16),
            paddingHorizontal: s(48),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 0.5,
            borderColor: 'rgba(239, 68, 68, 0.3)',
          }}
          onPress={handleLogout}
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
            Log Out
          </Text>
        </TouchableOpacity>

        <Text style={{
          textAlign: 'center',
          color: theme.textMuted,
          fontSize: s(12),
          fontFamily: theme.fontFamily,
          marginBottom: s(20),
        }}>
          Olen Chat v0.9.0 • Made for KamKam ❤️
        </Text>
      </ScrollView>
    </View>
  );
}
