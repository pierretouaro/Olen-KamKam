import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Dimensions,
  Alert,
  Animated,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Plus, 
  X, 
  Trash2, 
  Heart, 
  MessageCircle, 
  Smile,
  Flame,
  Laugh,
  Frown,
  PartyPopper,
  ThumbsUp,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 10000; // 10 seconds per story

interface Story {
  id: string;
  user_id: string;
  image_url: string;
  created_at: string;
  expires_at: string;
  profile?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
  reaction_count?: number;
}

interface StoryReaction {
  id: string;
  story_id: string;
  user_id: string;
  emoji: string;
  profile?: {
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

export default function StoriesBar() {
  const router = useRouter();
  const { theme, isDark, scale } = useTheme();
  const { session } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [currentUserStories, setCurrentUserStories] = useState<Story[]>([]);
  const [progress, setProgress] = useState(0);
  const [reactions, setReactions] = useState<StoryReaction[]>([]);
  const [showReactionsList, setShowReactionsList] = useState(false);
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [pressedEmoji, setPressedEmoji] = useState<string | null>(null);

  const QUICK_REACTIONS = [
    { emoji: '❤️', icon: Heart, color: '#EF4444' },
    { emoji: '🔥', icon: Flame, color: '#F97316' },
    { emoji: '😂', icon: Laugh, color: '#EAB308' },
    { emoji: '😮', icon: Frown, color: '#8B5CF6' },
    { emoji: '👏', icon: ThumbsUp, color: '#3B82F6' },
    { emoji: '🎉', icon: PartyPopper, color: '#EC4899' },
  ];

  const s = (size: number) => size * scale;

  const fetchStories = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Fetch all stories with profiles and reaction counts
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select(`
          *,
          profile:profiles(username, full_name, avatar_url),
          reactions:story_reactions(count)
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (storiesError) throw storiesError;

      // Add reaction count to each story
      const storiesWithCounts = (storiesData || []).map((story: any) => ({
        ...story,
        reaction_count: story.reactions?.[0]?.count || 0,
      }));

      // Fetch my profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('avatar_url, username, full_name')
        .eq('id', session.user.id)
        .single();

      const myStoriesData = storiesWithCounts?.filter((s: Story) => s.user_id === session.user.id) || [];
      const friendsStories = storiesWithCounts?.filter((s: Story) => s.user_id !== session.user.id) || [];

      setMyStories(myStoriesData);
      setStories(friendsStories);
      setMyProfile(profileData);
    } catch (err) {
      console.error('Error fetching stories:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchStories();
    }, [fetchStories])
  );

  useEffect(() => {
    const subscription = supabase
      .channel('stories_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
        fetchStories();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchStories]);

  // Pause story when reaction modal is open
  useEffect(() => {
    if (showReactionsList) {
      setIsPaused(true);
      progressAnim.stopAnimation();
    } else {
      setIsPaused(false);
    }
  }, [showReactionsList]);

  // Subscribe to all reaction changes to update story list reaction counts
  useEffect(() => {
    const subscription = supabase
      .channel('story_reactions_global')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'story_reactions' }, 
        () => {
          fetchStories();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchStories]);

  // Fetch reactions for a story
  const fetchReactions = useCallback(async (storyId: string) => {
    try {
      const { data, error } = await supabase
        .from('story_reactions')
        .select(`
          *,
          profile:profiles(username, full_name, avatar_url)
        `)
        .eq('story_id', storyId);

      if (error) throw error;
      setReactions(data || []);
    } catch (err) {
      console.error('Error fetching reactions:', err);
    }
  }, []);

  // Subscribe to reaction changes for current story
  useEffect(() => {
    if (!selectedStory) return;
    
    const subscription = supabase
      .channel(`story_reactions_${selectedStory.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'story_reactions', filter: `story_id=eq.${selectedStory.id}` }, 
        () => {
          fetchReactions(selectedStory.id);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedStory?.id, fetchReactions]);

  // Track remaining time for pause/resume
  const [remainingTime, setRemainingTime] = useState(STORY_DURATION);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-advance story timer
  useEffect(() => {
    if (selectedStory && currentUserStories.length > 0 && !isPaused) {
      // Always reset animation when story changes
      progressAnim.setValue(0);
      setProgress(0);
      
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: STORY_DURATION,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && !isPaused) {
          handleNextStory();
        }
      });

      // Update progress state for UI
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 1) {
            clearInterval(progressInterval);
            return 1;
          }
          return prev + (100 / (STORY_DURATION / 100));
        });
      }, 100);

      return () => {
        clearInterval(progressInterval);
        progressAnim.stopAnimation();
      };
    }
  }, [selectedStory?.id, selectedStoryIndex, isPaused]);

  const handleAddStory = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.9,
    });

    console.log('Image picker result:', result.canceled ? 'canceled' : `${result.assets?.length} images selected`);

    if (!result.canceled && result.assets && result.assets.length > 0) {
      console.log('Selected assets:', result.assets.map(a => a.uri.substring(0, 50)));
      setLoading(true);
      try {
        // Upload all selected images sequentially
        for (let i = 0; i < result.assets.length; i++) {
          console.log(`Uploading image ${i + 1}/${result.assets.length}`);
          await uploadStory(result.assets[i].uri, true);
        }
        // Refresh stories after all uploads complete
        await fetchStories();
      } finally {
        setLoading(false);
      }
    }
  };

  const uploadStory = async (uri: string, isBatch: boolean = false) => {
    if (!session?.user) return;
    
    if (!isBatch) setLoading(true);
    try {
      const fileExt = 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      // Read file directly using expo-file-system (handles file:// URIs properly)
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // Convert base64 to Uint8Array for React Native compatibility
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(filePath, bytes, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from('stories')
        .getPublicUrl(filePath);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error: insertError } = await supabase.from('stories').insert({
        user_id: session.user.id,
        image_url: publicUrl,
        expires_at: expiresAt.toISOString(),
      });

      if (insertError) throw new Error(insertError.message);

    } catch (err: any) {
      console.error('Error uploading story:', err);
      Alert.alert('Error', err?.message || 'Failed to upload story. Please try again.');
      throw err;
    } finally {
      if (!isBatch) setLoading(false);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    Alert.alert(
      'Delete Story',
      'Are you sure you want to delete this story?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const storyToDelete = currentUserStories.find(s => s.id === storyId);
              if (storyToDelete) {
                // Delete from database
                const { error } = await supabase.from('stories').delete().eq('id', storyId);
                if (error) throw error;

                // Try to delete from storage
                try {
                  const filePath = storyToDelete.image_url.split('/stories/').pop();
                  if (filePath) {
                    await supabase.storage.from('stories').remove([filePath]);
                  }
                } catch (e) {
                  console.log('Could not delete from storage', e);
                }

                // Update local state
                const updatedStories = currentUserStories.filter(s => s.id !== storyId);
                if (updatedStories.length === 0) {
                  setSelectedStory(null);
                  setCurrentUserStories([]);
                  progressAnim.setValue(0);
                } else if (selectedStoryIndex >= updatedStories.length) {
                  progressAnim.setValue(0);
                  setSelectedStoryIndex(updatedStories.length - 1);
                  setSelectedStory(updatedStories[updatedStories.length - 1]);
                } else {
                  progressAnim.setValue(0);
                  setCurrentUserStories(updatedStories);
                  setSelectedStory(updatedStories[selectedStoryIndex]);
                }
                
                fetchStories();
              }
            } catch (err) {
              console.error('Error deleting story:', err);
              Alert.alert('Error', 'Failed to delete story');
            }
          }
        },
      ]
    );
  };

  const addReaction = async (emoji: string) => {
    if (!selectedStory || !session?.user) return;
    
    // Animate the press
    setPressedEmoji(emoji);
    setTimeout(() => setPressedEmoji(null), 150);
    
    // Update stories state immediately for UI feedback
    const updateStoryReactionCount = (storyId: string, delta: number) => {
      setStories(prev => prev.map(s => 
        s.id === storyId ? { ...s, reaction_count: (s.reaction_count || 0) + delta } : s
      ));
      setMyStories(prev => prev.map(s => 
        s.id === storyId ? { ...s, reaction_count: (s.reaction_count || 0) + delta } : s
      ));
      setCurrentUserStories(prev => prev.map(s => 
        s.id === storyId ? { ...s, reaction_count: (s.reaction_count || 0) + delta } : s
      ));
    };
    
    try {
      // Check if user already reacted with this emoji
      const existingReaction = reactions.find(
        r => r.user_id === session.user.id && r.emoji === emoji
      );
      
      if (existingReaction) {
        // Remove reaction if already exists
        const { error } = await supabase
          .from('story_reactions')
          .delete()
          .eq('id', existingReaction.id);
        
        if (error) throw error;
        setReactions(prev => prev.filter(r => r.id !== existingReaction.id));
        updateStoryReactionCount(selectedStory.id, -1);
      } else {
        // Add new reaction
        const { data, error } = await supabase
          .from('story_reactions')
          .insert({
            story_id: selectedStory.id,
            user_id: session.user.id,
            emoji: emoji,
          })
          .select(`
            *,
            profile:profiles(username, avatar_url)
          `)
          .single();
        
        if (error) throw error;
        if (data) {
          setReactions(prev => [...prev, data]);
          updateStoryReactionCount(selectedStory.id, 1);
        }
      }
    } catch (err) {
      console.error('Error adding reaction:', err);
    }
  };

  const handleViewStory = (userStories: Story[], startIndex = 0) => {
    if (userStories.length === 0) return;
    console.log('Viewing stories:', userStories.map(s => ({ 
      id: s.id, 
      url: s.image_url,
      urlValid: s.image_url && s.image_url.startsWith('http')
    })));
    // Reset animation value first
    progressAnim.setValue(0);
    setCurrentUserStories(userStories);
    setSelectedStoryIndex(startIndex);
    setSelectedStory(userStories[startIndex]);
    setProgress(0);
    setReactions([]);
    setShowReactionsList(false);
    // Reset pause state
    setIsPaused(false);
    // Load reactions for the first story
    fetchReactions(userStories[startIndex].id);
  };

  const handleNextStory = () => {
    if (selectedStoryIndex < currentUserStories.length - 1) {
      const nextIndex = selectedStoryIndex + 1;
      const nextStory = currentUserStories[nextIndex];
      progressAnim.setValue(0);
      setSelectedStoryIndex(nextIndex);
      setSelectedStory(nextStory);
      setProgress(0);
      setReactions([]);
      fetchReactions(nextStory.id);
    } else {
      // No more stories, close viewer
      setSelectedStory(null);
      setCurrentUserStories([]);
      setReactions([]);
      progressAnim.setValue(0);
    }
  };

  const handlePrevStory = () => {
    if (selectedStoryIndex > 0) {
      const prevIndex = selectedStoryIndex - 1;
      const prevStory = currentUserStories[prevIndex];
      progressAnim.setValue(0);
      setSelectedStoryIndex(prevIndex);
      setSelectedStory(prevStory);
      setProgress(0);
      setReactions([]);
      fetchReactions(prevStory.id);
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

  // Group stories by user
  const storiesByUser = stories.reduce((acc, story) => {
    if (!acc[story.user_id]) {
      acc[story.user_id] = [];
    }
    acc[story.user_id].push(story);
    return acc;
  }, {} as Record<string, Story[]>);

  const hasStories = stories.length > 0 || myStories.length > 0;

  return (
    <>
      <View style={[localStyles.container, { backgroundColor: theme.background }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: s(16), gap: s(16) }}
        >
          {/* My Stories */}
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => myStories.length > 0 ? handleViewStory(myStories) : handleAddStory()}
              activeOpacity={0.8}
            >
              <View style={{
                width: s(82),
                height: s(82),
                borderRadius: s(41),
                padding: s(4),
                borderWidth: myStories.length > 0 ? 3 : 0,
                borderColor: theme.primary,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: myStories.length > 0 ? 'transparent' : theme.surfaceHighlight,
              }}>
                {myProfile?.avatar_url || session?.user?.user_metadata?.avatar_url ? (
                  <Image
                    source={{ uri: myProfile?.avatar_url || session?.user?.user_metadata?.avatar_url }}
                    style={{ width: s(70), height: s(70), borderRadius: s(35) }}
                    resizeMode="cover"
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
                    }}>
                      {(myProfile?.full_name || myProfile?.username || session?.user?.user_metadata?.username || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                {/* Always show add button */}
                <TouchableOpacity
                  onPress={handleAddStory}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: s(26),
                    height: s(26),
                    borderRadius: s(13),
                    backgroundColor: theme.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: theme.background,
                    zIndex: 10,
                  }}
                  activeOpacity={0.7}
                >
                  <Plus size={s(14)} color="#fff" strokeWidth={3} />
                </TouchableOpacity>

                {/* Reaction indicator for my stories */}
                {myStories.some(s => (s.reaction_count || 0) > 0) && (
                  <View style={{
                    position: 'absolute',
                    bottom: s(2),
                    left: s(2),
                    width: s(16),
                    height: s(16),
                    borderRadius: s(8),
                    backgroundColor: '#FF69B4',
                    borderWidth: 2,
                    borderColor: theme.background,
                  }} />
                )}
              </View>
            </TouchableOpacity>
            <Text style={{ 
              marginTop: s(6), 
              fontSize: s(12), 
              color: theme.textMuted, 
              fontWeight: '500',
            }}>
              {myStories.length > 0 ? 'Your story' : 'Add story'}
            </Text>
          </View>

          {/* Friends' Stories Grouped by User */}
          {Object.entries(storiesByUser).map(([userId, userStories]) => {
            const firstStory = userStories[0];
            return (
              <TouchableOpacity
                key={userId}
                style={{ alignItems: 'center' }}
                onPress={() => handleViewStory(userStories)}
                activeOpacity={0.8}
              >
                <View style={{
                  width: s(82),
                  height: s(82),
                  borderRadius: s(41),
                  padding: s(4),
                  borderWidth: 3,
                  borderColor: theme.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  {firstStory.profile?.avatar_url ? (
                    <Image
                      source={{ uri: firstStory.profile.avatar_url }}
                      style={{ width: s(70), height: s(70), borderRadius: s(35) }}
                      resizeMode="cover"
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
                      }}>
                        {(firstStory.profile?.full_name || firstStory.profile?.username || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {userStories.length > 1 && (
                    <View style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: s(22),
                      height: s(22),
                      borderRadius: s(11),
                      backgroundColor: theme.primary,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 2,
                      borderColor: theme.background,
                    }}>
                      <Text style={{ color: '#fff', fontSize: s(11), fontWeight: '700' }}>
                        {userStories.length}
                      </Text>
                    </View>
                  )}

                  {/* Reaction indicator */}
                  {userStories.some(s => (s.reaction_count || 0) > 0) && (
                    <View style={{
                      position: 'absolute',
                      bottom: s(2),
                      left: s(2),
                      width: s(16),
                      height: s(16),
                      borderRadius: s(8),
                      backgroundColor: '#EF4444',
                      borderWidth: 2,
                      borderColor: theme.background,
                    }} />
                  )}
                </View>
                <Text style={{ 
                  marginTop: s(6), 
                  fontSize: s(12), 
                  color: theme.textMuted, 
                  fontWeight: '500',
                }}>
                  {firstStory.profile?.username || 'User'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Story Viewer Modal */}
      <Modal
        visible={!!selectedStory}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSelectedStory(null);
          progressAnim.setValue(0);
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Progress Bars */}
          {currentUserStories.length > 0 && (
            <View style={{
              position: 'absolute',
              top: s(50),
              left: s(16),
              right: s(16),
              flexDirection: 'row',
              gap: s(4),
              zIndex: 30,
            }}>
              {currentUserStories.map((_, index) => (
                <View
                  key={index}
                  style={{
                    flex: 1,
                    height: s(3),
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    borderRadius: s(2),
                    overflow: 'hidden',
                  }}
                >
                  {index < selectedStoryIndex ? (
                    // Completed stories - full white
                    <View style={{ height: '100%', backgroundColor: '#fff', width: '100%' }} />
                  ) : index === selectedStoryIndex ? (
                    // Current story - animated progress
                    <Animated.View 
                      style={{
                        height: '100%',
                        backgroundColor: '#fff',
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      }}
                    />
                  ) : (
                    // Future stories - empty
                    <View style={{ height: '100%', width: '0%' }} />
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Story Image */}
          {selectedStory && (
            <View style={{ 
              flex: 1, 
              justifyContent: 'center', 
              alignItems: 'center',
              backgroundColor: '#000',
              zIndex: 1,
            }}>
              {selectedStory.image_url ? (
                <Image
                  source={{ uri: selectedStory.image_url }}
                  style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16 }}>No image URL</Text>
              )}
            </View>
          )}

          {/* Header Overlay */}
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: s(60),
            paddingHorizontal: s(16),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: s(12),
            zIndex: 25,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Avatar - Show story owner's avatar, not the story image */}
              {selectedStory?.profile?.avatar_url || (selectedStory?.user_id === session?.user?.id && (myProfile?.avatar_url || session?.user?.user_metadata?.avatar_url)) ? (
                <Image
                  source={{ 
                    uri: selectedStory?.profile?.avatar_url || myProfile?.avatar_url || session?.user?.user_metadata?.avatar_url 
                  }}
                  style={{ width: s(40), height: s(40), borderRadius: s(20), marginRight: s(12) }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{
                  width: s(40),
                  height: s(40),
                  borderRadius: s(20),
                  backgroundColor: theme.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: s(12),
                }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: s(16) }}>
                    {((selectedStory?.profile?.full_name || selectedStory?.profile?.username || myProfile?.full_name || myProfile?.username || 'U')[0]).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: s(16) }}>
                  {selectedStory?.profile?.full_name || selectedStory?.profile?.username || myProfile?.full_name || myProfile?.username || 'You'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: s(12) }}>
                  {selectedStory && getTimeLeft(selectedStory.expires_at)} left
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: s(12), alignItems: 'center' }}>
              {/* Reactions count - show for all stories with reactions */}
              {reactions.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShowReactionsList(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? 'rgba(40,40,50,0.9)' : 'rgba(255,255,255,0.9)',
                    borderRadius: s(16),
                    paddingHorizontal: s(10),
                    paddingVertical: s(6),
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                  }}
                >
                  <View style={{ flexDirection: 'row', marginRight: s(4), gap: s(2) }}>
                    {[...new Set(reactions.map(r => r.emoji))].slice(0, 2).map((emoji) => {
                      const reactionConfig = QUICK_REACTIONS.find(r => r.emoji === emoji);
                      if (!reactionConfig) return null;
                      const IconComponent = reactionConfig.icon;
                      return (
                        <IconComponent 
                          key={emoji}
                          size={s(14)} 
                          color={reactionConfig.color}
                          fill={reactionConfig.color}
                        />
                      );
                    })}
                  </View>
                  <Text style={{
                    color: isDark ? '#fff' : theme.text,
                    fontSize: s(13),
                    fontWeight: '700',
                  }}>
                    {reactions.length}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Delete button - only for own stories */}
              {selectedStory?.user_id === session?.user?.id && (
                <TouchableOpacity onPress={() => selectedStory && handleDeleteStory(selectedStory.id)}>
                  <Trash2 size={s(24)} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => {
                setSelectedStory(null);
                progressAnim.setValue(0);
              }}>
                <X size={s(28)} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Navigation Areas - positioned below header */}
          <View style={{ 
            position: 'absolute',
            top: s(120),
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: 'row',
            zIndex: 5,
          }}>
            <TouchableOpacity 
              style={{ flex: 1 }} 
              onPress={handlePrevStory}
              activeOpacity={1}
            />
            <TouchableOpacity 
              style={{ flex: 1 }} 
              onPress={handleNextStory}
              activeOpacity={1}
            />
          </View>

          {/* Reaction Bar at Bottom */}
          <View style={{
            position: 'absolute',
            bottom: s(30),
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'flex-end',
            paddingHorizontal: s(16),
            zIndex: 20,
          }}>
            {/* Quick Reactions - Floating Pill Design */}
            {selectedStory?.user_id !== session?.user?.id && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? 'rgba(40,40,50,0.95)' : 'rgba(255,255,255,0.95)',
                borderRadius: s(40),
                padding: s(5),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.4 : 0.15,
                shadowRadius: 12,
                elevation: 8,
                borderWidth: 0.5,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}>
                {QUICK_REACTIONS.map((reaction) => {
                  const hasReacted = reactions.some(
                    r => r.user_id === session?.user?.id && r.emoji === reaction.emoji
                  );
                  const isPressed = pressedEmoji === reaction.emoji;
                  const IconComponent = reaction.icon;
                  
                  return (
                    <TouchableOpacity
                      key={reaction.emoji}
                      onPress={() => addReaction(reaction.emoji)}
                      style={{
                        width: s(48),
                        height: s(48),
                        marginHorizontal: s(4),
                        borderRadius: s(24),
                        backgroundColor: hasReacted ? reaction.color : 'transparent',
                        justifyContent: 'center',
                        alignItems: 'center',
                        transform: [{ scale: isPressed ? 0.9 : 1 }],
                      }}
                      activeOpacity={0.7}
                    >
                      <IconComponent 
                        size={s(26)} 
                        color={hasReacted ? '#fff' : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'}
                        fill={hasReacted ? 'rgba(255,255,255,0.3)' : 'transparent'}
                        strokeWidth={hasReacted ? 2.5 : 2}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}


          </View>



          {/* Reactions List Modal */}
          <Modal
            visible={showReactionsList}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowReactionsList(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.5)',
                justifyContent: 'flex-end',
              }}
              onPress={() => setShowReactionsList(false)}
              activeOpacity={1}
            >
              <View style={{
                backgroundColor: theme.background,
                borderTopLeftRadius: s(28),
                borderTopRightRadius: s(28),
                maxHeight: SCREEN_HEIGHT * 0.75,
                paddingTop: s(16),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.2,
                shadowRadius: 20,
                elevation: 20,
              }}>
                {/* Handle bar */}
                <View style={{
                  width: s(36),
                  height: s(4),
                  backgroundColor: theme.border,
                  borderRadius: s(2),
                  alignSelf: 'center',
                  marginBottom: s(20),
                }} />

                {/* Header */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: s(20),
                  paddingBottom: s(16),
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      width: s(40),
                      height: s(40),
                      borderRadius: s(20),
                      backgroundColor: theme.primaryLight,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: s(12),
                    }}>
                      <Heart size={s(20)} color={theme.primary} fill={theme.primary} />
                    </View>
                    <View>
                      <Text style={{
                        color: theme.text,
                        fontSize: s(20),
                        fontWeight: '700',
                      }}>
                        {reactions.length} {reactions.length === 1 ? 'Reaction' : 'Reactions'}
                      </Text>
                      <Text style={{
                        color: theme.textMuted,
                        fontSize: s(13),
                        marginTop: s(2),
                      }}>
                        People who reacted to this story
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setShowReactionsList(false)}
                    style={{
                      width: s(36),
                      height: s(36),
                      borderRadius: s(18),
                      backgroundColor: theme.surfaceHighlight,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <X size={s(20)} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Reaction Type Tabs */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: s(16),
                    paddingVertical: s(12),
                    gap: s(10),
                  }}
                >
                  {/* All tab */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: theme.primary,
                      borderRadius: s(24),
                      paddingHorizontal: s(16),
                      paddingVertical: s(10),
                    }}
                  >
                    <Smile size={s(18)} color="#fff" />
                    <Text style={{
                      color: '#fff',
                      fontSize: s(15),
                      fontWeight: '700',
                      marginLeft: s(8),
                    }}>
                      All
                    </Text>
                    <View style={{
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      borderRadius: s(10),
                      paddingHorizontal: s(8),
                      paddingVertical: s(2),
                      marginLeft: s(8),
                    }}>
                      <Text style={{
                        color: '#fff',
                        fontSize: s(12),
                        fontWeight: '700',
                      }}>
                        {reactions.length}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Individual emoji tabs */}
                  {QUICK_REACTIONS.map((reaction) => {
                    const count = reactions.filter(r => r.emoji === reaction.emoji).length;
                    if (count === 0) return null;
                    const IconComponent = reaction.icon;
                    
                    return (
                      <TouchableOpacity
                        key={reaction.emoji}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: theme.surfaceHighlight,
                          borderRadius: s(24),
                          paddingHorizontal: s(14),
                          paddingVertical: s(10),
                          borderWidth: 1,
                          borderColor: theme.border,
                        }}
                      >
                        <IconComponent 
                          size={s(18)} 
                          color={reaction.color}
                          fill={reaction.color}
                        />
                        <Text style={{
                          color: theme.text,
                          fontSize: s(15),
                          fontWeight: '600',
                          marginLeft: s(8),
                        }}>
                          {count}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Divider */}
                <View style={{
                  height: 1,
                  backgroundColor: theme.border,
                  marginHorizontal: s(20),
                  marginVertical: s(8),
                }} />

                {/* Users List */}
                <ScrollView 
                  style={{ paddingHorizontal: s(16) }}
                  showsVerticalScrollIndicator={false}
                >
                  {reactions.map((reaction, index) => (
                    <View
                      key={reaction.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: s(14),
                        paddingHorizontal: s(12),
                        backgroundColor: theme.surface,
                        borderRadius: s(16),
                        marginBottom: s(10),
                      }}
                    >
                      {/* Avatar */}
                      {reaction.profile?.avatar_url ? (
                        <Image
                          source={{ uri: reaction.profile.avatar_url }}
                          style={{
                            width: s(48),
                            height: s(48),
                            borderRadius: s(24),
                            marginRight: s(14),
                            borderWidth: 2,
                            borderColor: theme.border,
                          }}
                        />
                      ) : (
                        <View style={{
                          width: s(48),
                          height: s(48),
                          borderRadius: s(24),
                          backgroundColor: theme.primary,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: s(14),
                        }}>
                          <Text style={{
                            color: '#fff',
                            fontSize: s(18),
                            fontWeight: '700',
                          }}>
                            {((reaction.profile?.full_name || reaction.profile?.username || 'U')[0]).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      {/* Username */}
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          color: theme.text,
                          fontSize: s(16),
                          fontWeight: '600',
                        }}>
                          {reaction.profile?.username || 'User'}
                        </Text>
                        <Text style={{
                          color: theme.textMuted,
                          fontSize: s(13),
                          marginTop: s(2),
                        }}>
                          Reacted with {reaction.emoji}
                        </Text>
                      </View>

                      {/* Reaction icon */}
                      {(() => {
                        const reactionConfig = QUICK_REACTIONS.find(r => r.emoji === reaction.emoji);
                        if (!reactionConfig) return <Text style={{ fontSize: s(24) }}>{reaction.emoji}</Text>;
                        const IconComponent = reactionConfig.icon;
                        return (
                          <View style={{
                            width: s(40),
                            height: s(40),
                            borderRadius: s(20),
                            backgroundColor: theme.surfaceHighlight,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}>
                            <IconComponent 
                              size={s(22)} 
                              color={reactionConfig.color}
                              fill={reactionConfig.color}
                            />
                          </View>
                        );
                      })()}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      </Modal>
    </>
  );
}

const localStyles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
});
