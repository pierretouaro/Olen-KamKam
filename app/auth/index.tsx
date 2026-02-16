import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import FadeInView from '../../components/FadeInView';
import AnimatedPressable from '../../components/AnimatedPressable';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, MessageCircle, User, Phone } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function AuthScreen() {
  const router = useRouter();
  const { theme, isDark, scale } = useTheme();
  const { signUp, signIn } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Scale function for responsive sizing
  const s = (size: number) => Math.round(size * scale);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');

  const validatePhone = (phone: string): boolean => {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    // Check if at least 10 digits
    return cleaned.length >= 10;
  };

  const formatPhoneNumber = (text: string): string => {
    // Remove non-digits
    const cleaned = text.replace(/\D/g, '');
    
    // Format as user types (US format example)
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    // Only allow digits and formatting characters
    const cleaned = text.replace(/[^\d\s\-\(\)\+]/g, '');
    setPhoneNumber(cleaned);
  };

  const handleSubmit = async () => {
    // Validation
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    if (!isLogin) {
      if (!username || !fullName || !phoneNumber) {
        setError('Please fill in all fields');
        return;
      }
      
      if (username.length < 3) {
        setError('Username must be at least 3 characters');
        return;
      }

      if (!validatePhone(phoneNumber)) {
        setError('Please enter a valid phone number');
        return;
      }
    }
    
    setLoading(true);
    setError('');
    
    try {
      if (isLogin) {
        await signIn(email, password);
        router.replace('/(tabs)');
      } else {
        await signUp(email, password, username, fullName, phoneNumber);
        
        // Show success and switch to login
        Alert.alert(
          'Account Created!',
          'Your account has been created successfully. Please sign in.',
          [{ text: 'OK', onPress: () => {
            setIsLogin(true);
            // Clear form
            setPhoneNumber('');
            setFullName('');
            setUsername('');
            setEmail('');
            setPassword('');
          }}]
        );
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: s(24), paddingVertical: s(40) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <Animated.View entering={FadeInUp.duration(600)} style={{ alignItems: 'center', marginBottom: s(40) }}>
          <LinearGradient
            colors={[theme.primary, theme.primary + '80']}
            style={{
              width: s(100),
              height: s(100),
              borderRadius: s(30),
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: s(24),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <MessageCircle size={s(48)} color="#fff" strokeWidth={2.5} />
          </LinearGradient>
          
          <Text style={{
            fontSize: s(32),
            fontWeight: '700',
            fontFamily: theme.fontFamilyBold,
            marginBottom: s(8),
            color: theme.text,
          }}>
            {isLogin ? 'Olen' : 'Create Account'}
          </Text>
          <Text style={{
            fontSize: s(16),
            fontWeight: '400',
            fontFamily: theme.fontFamily,
            color: theme.textMuted,
          }}>
            {isLogin 
              ? 'Sign in to continue messaging' 
              : 'Join the conversation today'}
          </Text>
        </Animated.View>

        {/* Form Section */}
        <Animated.View entering={FadeInUp.duration(600).delay(200)} style={{ gap: s(16) }}>
          {!isLogin && (
            <>
              {/* Full Name */}
              <FadeInView style={{
                borderRadius: s(24),
                paddingHorizontal: s(16),
                paddingVertical: s(12),
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              }}>
                <Text style={{
                  fontSize: s(12),
                  fontWeight: '600',
                  fontFamily: theme.fontFamilyMedium,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: s(8),
                  color: theme.textMuted,
                }}>Full Name</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <User size={s(20)} color={theme.primary} style={{ marginRight: s(12) }} />
                  <TextInput
                    style={{
                      flex: 1,
                      fontSize: s(16),
                      fontWeight: '500',
                      paddingVertical: s(4),
                      color: theme.text,
                    }}
                    placeholder="John Doe"
                    placeholderTextColor={theme.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>
              </FadeInView>

              {/* Username */}
              <FadeInView style={{
                borderRadius: s(24),
                paddingHorizontal: s(16),
                paddingVertical: s(12),
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              }}>
                <Text style={{
                  fontSize: s(12),
                  fontWeight: '600',
                  fontFamily: theme.fontFamilyMedium,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: s(8),
                  color: theme.textMuted,
                }}>Username</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{
                    fontSize: s(18),
                    fontWeight: '700',
                    fontFamily: theme.fontFamilyBold,
                    marginRight: s(8),
                    color: theme.primary,
                  }}>@</Text>
                  <TextInput
                    style={{
                      flex: 1,
                      fontSize: s(16),
                      fontWeight: '500',
                      paddingVertical: s(4),
                      color: theme.text,
                    }}
                    placeholder="johndoe"
                    placeholderTextColor={theme.textMuted}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>
              </FadeInView>

              {/* Phone Number */}
              <FadeInView style={{
                borderRadius: s(24),
                paddingHorizontal: s(16),
                paddingVertical: s(12),
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              }}>
                <Text style={{
                  fontSize: s(12),
                  fontWeight: '600',
                  fontFamily: theme.fontFamilyMedium,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: s(8),
                  color: theme.textMuted,
                }}>Phone Number</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Phone size={s(20)} color={theme.primary} style={{ marginRight: s(12) }} />
                  <TextInput
                    style={{
                      flex: 1,
                      fontSize: s(16),
                      fontWeight: '500',
                      paddingVertical: s(4),
                      color: theme.text,
                    }}
                    placeholder="(555) 000-0000"
                    placeholderTextColor={theme.textMuted}
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    editable={!loading}
                    maxLength={14}
                  />
                </View>
                <Text style={{
                  fontSize: s(12),
                  fontFamily: theme.fontFamily,
                  marginTop: s(6),
                  marginLeft: s(32),
                  color: theme.textMuted,
                }}>
                  Used to find your friends
                </Text>
              </FadeInView>
            </>
          )}

          {/* Email */}
          <FadeInView style={{
            borderRadius: s(24),
            paddingHorizontal: s(16),
            paddingVertical: s(12),
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
          }}>
            <Text style={{
              fontSize: s(12),
              fontWeight: '600',
              fontFamily: theme.fontFamilyMedium,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: s(8),
              color: theme.textMuted,
            }}>Email</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Mail size={s(20)} color={theme.primary} style={{ marginRight: s(12) }} />
              <TextInput
                style={{
                  flex: 1,
                  fontSize: s(16),
                  fontWeight: '500',
                  paddingVertical: s(4),
                  color: theme.text,
                }}
                placeholder="john@example.com"
                placeholderTextColor={theme.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!loading}
              />
            </View>
          </FadeInView>

          {/* Password */}
          <FadeInView style={{
            borderRadius: s(24),
            paddingHorizontal: s(16),
            paddingVertical: s(12),
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
          }}>
            <Text style={{
              fontSize: s(12),
              fontWeight: '600',
              fontFamily: theme.fontFamilyMedium,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: s(8),
              color: theme.textMuted,
            }}>Password</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Lock size={s(20)} color={theme.primary} style={{ marginRight: s(12) }} />
              <TextInput
                style={{
                  flex: 1,
                  fontSize: s(16),
                  fontWeight: '500',
                  paddingVertical: s(4),
                  color: theme.text,
                }}
                placeholder="••••••••"
                placeholderTextColor={theme.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff size={s(20)} color={theme.textMuted} />
                ) : (
                  <Eye size={s(20)} color={theme.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </FadeInView>

          {/* Error Message */}
          {error ? (
            <Text style={{
              textAlign: 'center',
              fontSize: s(14),
              fontWeight: '500',
              fontFamily: theme.fontFamilyMedium,
              color: '#EF4444',
            }}>
              {error}
            </Text>
          ) : null}

          {/* Submit Button */}
          <AnimatedPressable
            style={{
              height: s(56),
              borderRadius: s(28),
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: s(8),
              backgroundColor: theme.primaryLight,
              borderWidth: 0.5,
              borderColor: theme.primaryLight,
              opacity: loading ? 0.7 : 1,
            }}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <Text style={{
                color: theme.primary,
                fontSize: s(17),
                fontWeight: '600',
                fontFamily: theme.fontFamilyMedium,
              }}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </AnimatedPressable>

          {/* Switch Login/Register */}
          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: s(8) }}
            onPress={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            disabled={loading}
          >
            <Text style={{
              fontSize: s(15),
              fontFamily: theme.fontFamily,
              color: theme.textMuted,
            }}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text style={{
                fontWeight: '600',
                fontFamily: theme.fontFamilyMedium,
                color: theme.primary,
              }}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
