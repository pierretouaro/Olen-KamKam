import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Clock3 } from 'lucide-react-native';

interface Note {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  expires_at: string;
  profile: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

interface UserProfile {
  avatar_url: string;
  username: string;
  full_name: string;
}

export default function NotesBar() {
  const router = useRouter();
  const { theme, isDark, scale } = useTheme();
  const { session } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [myNote, setMyNote] = useState<Note | null>(null);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const s = (size: number) => size * scale;

  const fetchNotes = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Fetch notes and my profile in parallel
      const [{ data: notesData, error: notesError }, { data: profileData }] = await Promise.all([
        supabase
          .from('notes')
          .select(`
            *,
            profile:profiles(username, full_name, avatar_url)
          `)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('avatar_url, username, full_name')
          .eq('id', session.user.id)
          .single(),
      ]);

      if (notesError) throw notesError;

      const myNoteData = notesData?.find((n: Note) => n.user_id === session.user.id);
      const friendsNotes = notesData?.filter((n: Note) => n.user_id !== session.user.id) || [];

      setMyNote(myNoteData || null);
      setNotes(friendsNotes);
      setMyProfile(profileData);
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [fetchNotes])
  );

  useEffect(() => {
    const subscription = supabase
      .channel('notes_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        () => fetchNotes()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchNotes]);

  const handleAddNote = () => {
    if (myNote) {
      // Edit existing note
      router.push({
        pathname: '/add-note',
        params: {
          existingNoteId: myNote.id,
          existingContent: myNote.content,
        },
      });
    } else {
      // Create new note
      router.push('/add-note');
    }
  };

  const getTimeLeft = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <View style={[localStyles.container, { backgroundColor: theme.background, paddingVertical: s(20) }]}>
        <ActivityIndicator color={theme.primary} size="small" />
      </View>
    );
  }

  return (
    <>
      <View style={[localStyles.container, { backgroundColor: theme.background }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: s(16), gap: s(16) }}
        >
          {/* My Note */}
          <TouchableOpacity
            style={{ alignItems: 'center' }}
            onPress={handleAddNote}
            activeOpacity={0.8}
          >
            <View style={{
              width: s(82),
              height: s(82),
              borderRadius: s(41),
              padding: s(4),
              borderWidth: myNote ? 2 : 0,
              borderColor: theme.primary,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              {myProfile?.avatar_url || session?.user?.user_metadata?.avatar_url ? (
                <Image
                  source={{ uri: myProfile?.avatar_url || session?.user?.user_metadata?.avatar_url }}
                  style={{ width: s(70), height: s(70), borderRadius: s(35) }}
                  contentFit="cover"
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
              {!myNote && (
                <View style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: s(24),
                  height: s(24),
                  borderRadius: s(12),
                  backgroundColor: theme.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: '#fff',
                }}>
                  <Plus size={s(12)} color="#fff" strokeWidth={3} />
                </View>
              )}
            </View>
            <Text style={{ 
              marginTop: s(6), 
              fontSize: s(12), 
              color: theme.textMuted, 
              fontFamily: theme.fontFamily 
            }}>
              {myNote ? 'Your note' : 'Add note'}
            </Text>
          </TouchableOpacity>

          {/* Friends' Notes */}
          {notes.map((note) => (
            <TouchableOpacity
              key={note.id}
              style={{ alignItems: 'center' }}
              onPress={() => setSelectedNote(note)}
              activeOpacity={0.8}
            >
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
                {note.profile?.avatar_url ? (
                  <Image
                    source={{ uri: note.profile.avatar_url }}
                    style={{ width: s(70), height: s(70), borderRadius: s(35) }}
                    contentFit="cover"
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
                      {(note.profile?.full_name || note.profile?.username || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ 
                marginTop: s(6), 
                fontSize: s(12), 
                color: theme.textMuted, 
                fontFamily: theme.fontFamily 
              }}>
                {note.profile?.username || 'User'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Note Detail Modal */}
      <Modal
        visible={!!selectedNote}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNote(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)' }}
          onPress={() => setSelectedNote(null)}
          activeOpacity={1}
        >
          <View style={{ alignItems: 'center', padding: s(24) }}>
            {selectedNote && (
              <>
                {/* Note Bubble - Above avatar, smaller rounded rectangle */}
                <View style={{
                  backgroundColor: theme.surface,
                  paddingVertical: s(12),
                  paddingHorizontal: s(20),
                  borderRadius: s(32),
                  marginBottom: s(20),
                  minWidth: s(160),
                  maxWidth: s(240),

                }}>
                  <Text style={{ 
                    fontSize: s(15), 
                    lineHeight: s(20), 
                    color: theme.text, 
                    fontFamily: theme.fontFamily,
                    textAlign: 'center',
                  }}>
                    {selectedNote.content}
                  </Text>
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginTop: s(8), 
                    gap: s(4) 
                  }}>
                    <Clock3 size={s(11)} color={theme.textMuted} />
                    <Text style={{ 
                      fontSize: s(11), 
                      color: theme.textMuted, 
                      fontFamily: theme.fontFamily 
                    }}>
                      {getTimeLeft(selectedNote.expires_at)} left
                    </Text>
                  </View>
                </View>

                {/* Avatar - Bigger with floating ring */}
                <View style={{
                  width: s(110),
                  height: s(110),
                  borderRadius: s(55),
                  padding: s(4),
                  borderWidth: 2,
                  borderColor: theme.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  {selectedNote.profile?.avatar_url ? (
                    <Image
                      source={{ uri: selectedNote.profile.avatar_url }}
                      style={{ 
                        width: s(100), 
                        height: s(100), 
                        borderRadius: s(50),
                      }}
                    />
                  ) : (
                    <View style={{
                      width: s(100),
                      height: s(100),
                      borderRadius: s(50),
                      backgroundColor: theme.primary,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Text style={{
                        fontSize: s(40),
                        color: '#fff',
                        fontWeight: '700',
                        fontFamily: theme.fontFamilyBold,
                      }}>
                        {(selectedNote.profile?.full_name || selectedNote.profile?.username || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                
                <Text style={{ 
                  marginTop: s(16), 
                  fontSize: s(17), 
                  color: '#F8FAFC', 
                  fontFamily: theme.fontFamilyMedium 
                }}>
                  {selectedNote.profile?.full_name || selectedNote.profile?.username}
                </Text>
                
                <Text style={{ 
                  marginTop: s(4), 
                  fontSize: s(13), 
                  color: 'rgba(255,255,255,0.6)', 
                  fontFamily: theme.fontFamily 
                }}>
                  @{selectedNote.profile?.username}
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const localStyles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
});
