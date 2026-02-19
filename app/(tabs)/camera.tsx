import { useState, useRef, useEffect } from 'react';
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
  Plus
} from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CameraScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { session } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const s = (size: number) => size;

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.9,
    });

    if (!result.canceled) {
      setCapturedImage(result.assets[0].uri);
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
  };

  const uploadStory = async () => {
    if (!capturedImage || !session?.user) return;

    setUploading(true);
    try {
      // Upload new image
      const fileExt = 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      // Read file directly using expo-file-system (handles file:// URIs properly)
      const base64 = await FileSystem.readAsStringAsync(capturedImage, {
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

      // Create story record
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error: insertError } = await supabase.from('stories').insert({
        user_id: session.user.id,
        image_url: publicUrl,
        expires_at: expiresAt.toISOString(),
      });

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

  if (capturedImage) {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: capturedImage }} style={styles.previewImage} />
        
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
          Add to Story
        </Text>
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

          <TouchableOpacity 
            style={[styles.captureButton, { backgroundColor: theme.primary }]}
            onPress={takePicture}
            activeOpacity={0.8}
          >
            <View style={styles.captureInner} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.flipButton}
            onPress={toggleCameraFacing}
          >
            <RotateCcw size={28} color="#fff" />
          </TouchableOpacity>
        </View>
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
