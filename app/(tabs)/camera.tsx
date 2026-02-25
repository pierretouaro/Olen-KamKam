import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  X, 
  Zap, 
  ZapOff, 
  RotateCcw, 
  Check,
  Image as ImageIcon,
  Camera,
  Plus,
  Video
} from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { VideoView, useVideoPlayer } from 'expo-video';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Video Preview Component
function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.play();
  });

  return (
    <View style={styles.previewVideoContainer}>
      <VideoView
        style={styles.previewVideo}
        player={player}
        contentFit="contain"
      />
    </View>
  );
}

export default function CameraScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { session } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const s = (size: number) => size;

  // All hooks and callbacks must be defined BEFORE any early return
  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isStartingRecording || isRecordingRef.current) return;

    setIsStartingRecording(true);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Start timer first
      let duration = 0;
      isRecordingRef.current = true;
      setIsRecording(true);
      
      recordingTimerRef.current = setInterval(() => {
        duration += 1;
        setVideoDuration(duration);
        // Auto-stop at 60 seconds
        if (duration >= 60) {
          // Just stop the recording
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          cameraRef.current?.stopRecording();
        }
      }, 1000);

      // Small delay to ensure UI updates before starting recording
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start recording - this promise resolves when stopRecording() is called
      const video = await cameraRef.current.recordAsync({
        maxDuration: 60,
      });

      // Recording stopped - clean up
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsStartingRecording(false);

      if (video) {
        setCapturedVideo(video.uri);
      }
    } catch (error: any) {
      // Don't show alert for "stopped before any data" error - it's expected on quick tap
      if (!error?.message?.includes('stopped before any data')) {
        Alert.alert('Error', 'Failed to record video');
      }
      console.error('Recording error:', error);
      
      // Clean up
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsStartingRecording(false);
    }
  }, [isStartingRecording]);

  const stopRecording = useCallback(() => {
    if (!cameraRef.current || !isRecordingRef.current) return;
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    try {
      cameraRef.current.stopRecording();
    } catch (e) {
      // Ignore errors from stopping recording
    }
    isRecordingRef.current = false;
    setIsRecording(false);
  }, []);

  const handleRecordPress = useCallback(() => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!permission.granted) {
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
          <Camera size={s(48)} color={theme.primary} />
        </View>
        <Text style={{
          color: theme.text,
          fontSize: s(22),
          fontWeight: '700',
          fontFamily: theme.fontFamilyBold,
          marginBottom: s(8),
          textAlign: 'center',
        }}>
          Camera Access
        </Text>
        <Text style={{
          color: theme.textMuted,
          fontSize: s(16),
          fontFamily: theme.fontFamily,
          textAlign: 'center',
          marginBottom: s(32),
          lineHeight: s(24),
        }}>
          We need access to your camera so you can take photos to share as stories
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
          onPress={requestPermission}
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

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.9,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.type === 'video' || (asset.duration && asset.duration > 0)) {
        // Limit video duration to 60 seconds
        const duration = asset.duration || 0;
        if (duration > 60) {
          Alert.alert('Video too long', 'Please select a video that is 60 seconds or less.');
          return;
        }
        setCapturedVideo(asset.uri);
        setVideoDuration(Math.round(duration));
      } else {
        setCapturedImage(asset.uri);
      }
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        base64: false,
        skipProcessing: Platform.OS === 'android',
        shutterSound: false,
      });

      if (photo) {
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 1080 } }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        setCapturedImage(manipulatedImage.uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take picture');
      console.error(error);
    }
  };

  const retakePicture = () => {
    setCapturedImage(null);
    setCapturedVideo(null);
    setVideoDuration(0);
  };

  const uploadStory = async () => {
    if ((!capturedImage && !capturedVideo) || !session?.user) return;

    setUploading(true);
    try {
      const isVideo = !!capturedVideo;
      const fileUri = capturedVideo || capturedImage;
      const fileExt = isVideo ? 'mp4' : 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      // Read file directly using expo-file-system (handles file:// URIs properly)
      const base64 = await FileSystem.readAsStringAsync(fileUri!, {
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
          contentType: isVideo ? 'video/mp4' : 'image/jpeg',
          cacheControl: '3600',
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from('stories')
        .getPublicUrl(filePath);

      // Create story record
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const storyData: any = {
        user_id: session.user.id,
        expires_at: expiresAt.toISOString(),
      };

      if (isVideo) {
        storyData.video_url = publicUrl;
        storyData.duration = videoDuration;
      } else {
        storyData.image_url = publicUrl;
        storyData.duration = 10; // Default 10s for images
      }

      const { error: insertError } = await supabase.from('stories').insert(storyData);

      if (insertError) throw new Error(insertError.message);

      Alert.alert('Success', 'Story uploaded!');
      router.back();
    } catch (err: any) {
      console.error('Error uploading story:', err);
      Alert.alert('Error', err?.message || 'Failed to upload story. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const closeCamera = () => {
    router.back();
  };

  if (capturedImage || capturedVideo) {
    const isVideo = !!capturedVideo;
    
    return (
      <View style={styles.previewContainer}>
        {isVideo ? (
          <VideoPreview uri={capturedVideo} />
        ) : (
          <Image source={{ uri: capturedImage! }} style={styles.previewImage} />
        )}
        
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={retakePicture} style={styles.previewButton}>
            <X size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.previewFooter}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={retakePicture}
          >
            <RotateCcw size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
            onPress={uploadStory}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Plus size={32} color="#fff" />
            )}
          </TouchableOpacity>
          
          <View style={{ width: 50 }} />
        </View>

        <Text style={{
          position: 'absolute',
          bottom: 130,
          alignSelf: 'center',
          color: '#fff',
          fontSize: 16,
          fontWeight: '600',
          textShadowColor: 'rgba(0,0,0,0.5)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }}>
          {isVideo ? 'Video Story' : 'Add to Story'}
        </Text>
        
        {isVideo && (
          <Text style={{
            position: 'absolute',
            bottom: 150,
            alignSelf: 'center',
            color: '#fff',
            fontSize: 14,
            fontWeight: '500',
            textShadowColor: 'rgba(0,0,0,0.5)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}>
            {Math.round(videoDuration)}s
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        flash={flash}
        ref={cameraRef}
        mute={true}
      >
        {/* Header Controls */}
        <View style={styles.header}>
          <TouchableOpacity onPress={closeCamera} style={styles.headerButton}>
            <X size={28} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={toggleFlash} style={styles.headerButton}>
            {flash === 'on' ? (
              <Zap size={24} color="#FFD700" fill="#FFD700" />
            ) : (
              <ZapOff size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Focus Frame */}
        <View style={styles.focusContainer}>
          <View style={styles.focusFrame} />
        </View>

        {/* Bottom Controls */}
        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.galleryButton}
            onPress={openGallery}
          >
            <ImageIcon size={24} color="#fff" />
          </TouchableOpacity>

          {/* Photo Button */}
          <TouchableOpacity 
            style={[styles.captureButton, { backgroundColor: theme.primary }]}
            onPress={takePicture}
            activeOpacity={0.8}
          >
            <View style={styles.captureInner} />
          </TouchableOpacity>

          {/* Video Record Button */}
          <TouchableOpacity 
            style={[styles.videoButton, { 
              backgroundColor: isRecording ? '#EF4444' : isStartingRecording ? 'rgba(239, 68, 68, 0.5)' : 'rgba(0,0,0,0.5)',
              opacity: isStartingRecording ? 0.7 : 1,
            }]}
            onPress={handleRecordPress}
            activeOpacity={0.8}
            disabled={isStartingRecording}
          >
            {isRecording ? (
              <View style={{ width: 20, height: 20, backgroundColor: '#fff', borderRadius: 4 }} />
            ) : isStartingRecording ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Video size={24} color="#fff" />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.flipButton}
            onPress={toggleCameraFacing}
          >
            <RotateCcw size={28} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Recording Timer */}
        {isRecording && (
          <View style={{
            position: 'absolute',
            bottom: 130,
            alignSelf: 'center',
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderRadius: 16,
          }}>
            <Text style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: '700',
            }}>
              {videoDuration}s / 60s
            </Text>
          </View>
        )}
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusFrame: {
    width: 250,
    height: 250,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  captureInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
  },
  videoButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  previewVideoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewVideo: {
    flex: 1,
  },
  previewHeader: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  previewButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewFooter: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
