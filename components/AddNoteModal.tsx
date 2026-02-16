import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { X, Music, Send, Trash2 } from 'lucide-react-native';

interface AddNoteModalProps {
  visible: boolean;
  onClose: () => void;
  onNoteAdded: () => void;
  existingNote?: {
    id: string;
    content: string;
    expires_at: string;
  } | null;
}

const MAX_NOTE_LENGTH = 60;
const NOTE_DURATION_HOURS = 24;

export default function AddNoteModal({ visible, onClose, onNoteAdded, existingNote }: AddNoteModalProps) {
  const { theme, isDark, scale } = useTheme();
  const { session } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const s = (size: number) => size * scale;

  useEffect(() => {
    if (existingNote) {
      setContent(existingNote.content);
    } else {
      setContent('');
    }
  }, [existingNote, visible]);

  const handleSubmit = async () => {
    if (!content.trim() || !session?.user?.id) return;

    setLoading(true);
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + NOTE_DURATION_HOURS);

      if (existingNote) {
        const { error } = await supabase
          .from('notes')
          .update({
            content: content.trim(),
            created_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .eq('id', existingNote.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notes')
          .insert({
            user_id: session.user.id,
            content: content.trim(),
            expires_at: expiresAt.toISOString(),
          });

        if (error) throw error;
      }

      onNoteAdded();
      onClose();
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingNote?.id) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', existingNote.id);

      if (error) throw error;

      onNoteAdded();
      onClose();
    } catch (err) {
      console.error('Error deleting note:', err);
    } finally {
      setDeleting(false);
    }
  };

  const charCount = content.length;
  const canSubmit = content.trim().length > 0 && charCount <= MAX_NOTE_LENGTH;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.9)' }}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: s(16),
          paddingTop: Platform.OS === 'ios' ? s(60) : s(20),
          paddingBottom: s(16),
        }}>
          <TouchableOpacity onPress={onClose} style={{ padding: s(8) }}>
            <X size={s(24)} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: s(17), fontWeight: '600' }}>
            {existingNote ? 'Edit Note' : 'New Note'}
          </Text>
          {existingNote ? (
            <TouchableOpacity onPress={handleDelete} style={{ padding: s(8) }} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator color="#EF4444" size="small" />
              ) : (
                <Trash2 size={s(22)} color="#EF4444" />
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: s(40) }} />
          )}
        </View>

        {/* Content */}
        <View style={{ padding: s(24), paddingBottom: Platform.OS === 'ios' ? s(40) : s(24) }}>
          {/* Preview */}
          <View style={{ alignItems: 'center', marginBottom: s(32) }}>
            <Image
              source={{ uri: session?.user?.user_metadata?.avatar_url || 'https://via.placeholder.com/100' }}
              style={{ 
                width: s(90), 
                height: s(90), 
                borderRadius: s(45), 
                borderWidth: 3, 
                borderColor: '#fff' 
              }}
            />
            
            {/* Speech Bubble Preview */}
            <View style={{
              maxWidth: s(280),
              padding: s(16),
              borderRadius: s(20),
              borderBottomLeftRadius: s(4),
              marginTop: s(16),
              backgroundColor: theme.surface,
            }}>
              <Text style={{ 
                fontSize: s(16), 
                lineHeight: s(22), 
                color: theme.text, 
                fontFamily: theme.fontFamily 
              }}>
                {content.trim() || 'Your note will appear here...'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: s(12), gap: s(6) }}>
                <Music size={s(14)} color={theme.textMuted} />
                <Text style={{ 
                  fontSize: s(12), 
                  color: theme.textMuted, 
                  fontFamily: theme.fontFamily 
                }}>
                  24h
                </Text>
              </View>
            </View>
          </View>

          {/* Input */}
          <View style={{
            borderRadius: s(16),
            padding: s(16),
            marginBottom: s(16),
            backgroundColor: theme.surface,
          }}>
            <TextInput
              style={{
                fontSize: s(16),
                minHeight: s(80),
                textAlignVertical: 'top',
                color: theme.text,
                fontFamily: theme.fontFamily,
              }}
              placeholder="Share what's on your mind..."
              placeholderTextColor={theme.textMuted}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={MAX_NOTE_LENGTH}
              autoFocus
            />
            <Text style={{
              fontSize: s(12),
              textAlign: 'right',
              marginTop: s(8),
              color: charCount > MAX_NOTE_LENGTH ? '#EF4444' : theme.textMuted,
              fontFamily: theme.fontFamily,
            }}>
              {charCount}/{MAX_NOTE_LENGTH}
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: s(16),
              borderRadius: s(12),
              marginBottom: s(16),
              backgroundColor: theme.primary,
              opacity: canSubmit ? 1 : 0.5,
            }}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={{ 
                  color: '#fff', 
                  fontSize: s(16), 
                  fontWeight: '600', 
                  fontFamily: theme.fontFamilyMedium 
                }}>
                  {existingNote ? 'Update Note' : 'Share Note'}
                </Text>
                <Send size={s(18)} color="#fff" style={{ marginLeft: s(8) }} />
              </>
            )}
          </TouchableOpacity>

          <Text style={{
            fontSize: s(13),
            textAlign: 'center',
            color: theme.textMuted,
            fontFamily: theme.fontFamily,
          }}>
            Notes disappear after 24 hours
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
