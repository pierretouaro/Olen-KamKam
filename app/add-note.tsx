import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { X, Clock, Send, Trash2 } from 'lucide-react-native';

const MAX_NOTE_LENGTH = 60;
const NOTE_DURATION_HOURS = 24;

export default function AddNoteScreen() {
  const router = useRouter();
  const { existingNoteId, existingContent } = useLocalSearchParams();
  const { theme, isDark, scale } = useTheme();
  const { session, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [myProfile, setMyProfile] = useState<{ avatar_url: string; full_name: string } | null>(null);

  const s = (size: number) => size * scale;

  useEffect(() => {
    if (existingContent) {
      setContent(String(existingContent));
    }
    fetchMyProfile();
  }, [existingContent]);

  const fetchMyProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url, full_name')
      .eq('id', user.id)
      .single();
    if (data) setMyProfile(data);
  };

  const handleShare = async () => {
    if (!content.trim() || !user) return;

    setLoading(true);
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + NOTE_DURATION_HOURS);

      if (existingNoteId) {
        const { error } = await supabase
          .from('notes')
          .update({
            content: content.trim(),
            created_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .eq('id', existingNoteId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notes')
          .insert({
            user_id: user.id,
            content: content.trim(),
            expires_at: expiresAt.toISOString(),
          });

        if (error) throw error;
      }

      router.back();
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingNoteId) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', existingNoteId);

      if (error) throw error;
      router.back();
    } catch (err) {
      console.error('Error deleting note:', err);
    } finally {
      setDeleting(false);
    }
  };

  const charCount = content.length;
  const canShare = content.trim().length > 0 && charCount <= MAX_NOTE_LENGTH;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + s(10),
        paddingHorizontal: s(20),
        paddingBottom: s(10),
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
          <X size={s(22)} color={theme.text} />
        </TouchableOpacity>
        
        <Text style={{
          fontSize: s(18),
          fontWeight: '600',
          color: theme.text,
          fontFamily: theme.fontFamilyMedium,
        }}>
          {existingNoteId ? 'Edit Note' : 'New Note'}
        </Text>
        
        {existingNoteId ? (
          <TouchableOpacity 
            onPress={handleDelete}
            disabled={deleting}
            style={{
              width: s(40),
              height: s(40),
              borderRadius: s(20),
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {deleting ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <Trash2 size={s(20)} color="#EF4444" />
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: s(40) }} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? s(20) : 0}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ 
            paddingHorizontal: s(24),
            paddingBottom: insets.bottom + s(100),
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Preview Section */}
          <View style={{ 
            alignItems: 'center',
            marginTop: s(20),
            marginBottom: s(32),
          }}>
            {/* Note Bubble - Pill Shape */}
            <View style={{
              backgroundColor: theme.surface,
              paddingVertical: s(16),
              paddingHorizontal: s(28),
              borderRadius: s(32),
              marginBottom: s(20),
              minWidth: s(200),
              maxWidth: s(320),
              borderWidth: 1,
              borderColor: theme.border,
            }}>
              <Text style={{ 
                fontSize: s(17), 
                lineHeight: s(24), 
                color: theme.text, 
                fontFamily: theme.fontFamily,
                textAlign: 'center',
              }}>
                {content.trim() || 'Your note preview...'}
              </Text>
              
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: s(10),
                gap: s(6),
              }}>
                <Clock size={s(13)} color={theme.textMuted} />
                <Text style={{ 
                  fontSize: s(12), 
                  color: theme.textMuted, 
                  fontFamily: theme.fontFamily 
                }}>
                  24 hours
                </Text>
              </View>
            </View>

            {/* Avatar with ring */}
            <View style={{
              width: s(82),
              height: s(82),
              borderRadius: s(41),
              padding: s(4),
              borderWidth: 2,
              borderColor: theme.primary,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              {myProfile?.avatar_url || session?.user?.user_metadata?.avatar_url ? (
                <Image
                  source={{ 
                    uri: myProfile?.avatar_url || session?.user?.user_metadata?.avatar_url 
                  }}
                  style={{
                    width: s(70),
                    height: s(70),
                    borderRadius: s(35),
                  }}
                />
              ) : (
                <View style={{
                  width: s(70),
                  height: s(70),
                  borderRadius: s(35),
                  backgroundColor: theme.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Text style={{
                    fontSize: s(28),
                    color: '#fff',
                    fontWeight: '700',
                    fontFamily: theme.fontFamilyBold,
                  }}>
                    {(myProfile?.full_name || myProfile?.username || session?.user?.user_metadata?.username || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            <Text style={{
              marginTop: s(12),
              fontSize: s(15),
              color: theme.textMuted,
              fontFamily: theme.fontFamily,
            }}>
              @{myProfile?.full_name || session?.user?.user_metadata?.username || 'You'}
            </Text>
          </View>

          {/* Input Section */}
          <View style={{
            backgroundColor: theme.surface,
            borderRadius: s(20),
            padding: s(20),
            marginBottom: s(16),
            borderWidth: 1,
            borderColor: theme.border,
          }}>
            <TextInput
              style={{
                fontSize: s(17),
                lineHeight: s(24),
                color: theme.text,
                fontFamily: theme.fontFamily,
                minHeight: s(80),
                textAlignVertical: 'top',
              }}
              placeholder="What's on your mind?"
              placeholderTextColor={theme.textMuted}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={MAX_NOTE_LENGTH}
            />
            <Text style={{
              fontSize: s(13),
              color: charCount > MAX_NOTE_LENGTH ? '#EF4444' : theme.textMuted,
              fontFamily: theme.fontFamily,
              textAlign: 'right',
              marginTop: s(8),
            }}>
              {charCount}/{MAX_NOTE_LENGTH}
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Share Button - Fixed at bottom */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: s(24),
          paddingBottom: insets.bottom + s(24),
          paddingTop: s(16),
          backgroundColor: theme.background,
          borderTopWidth: 0.5,
          borderTopColor: theme.border,
        }}>
          <TouchableOpacity
            onPress={handleShare}
            disabled={!canShare || loading}
            style={{
              backgroundColor: theme.primary,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: s(16),
              borderRadius: s(16),
              opacity: canShare ? 1 : 0.5,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Send size={s(20)} color="#fff" style={{ marginRight: s(8) }} />
                <Text style={{
                  color: '#fff',
                  fontSize: s(17),
                  fontWeight: '600',
                  fontFamily: theme.fontFamilyMedium,
                }}>
                  {existingNoteId ? 'Update Note' : 'Share Note'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          <Text style={{
            fontSize: s(12),
            color: theme.textMuted,
            fontFamily: theme.fontFamily,
            textAlign: 'center',
            marginTop: s(12),
          }}>
            Notes disappear after 24 hours
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
