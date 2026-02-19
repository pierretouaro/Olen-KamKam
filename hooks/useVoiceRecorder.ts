import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  recordingUri: string | null;
}

export const useVoiceRecorder = () => {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    recordingUri: null,
  });

  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  const requestPermissions = async (): Promise<boolean> => {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  };

  const startRecording = useCallback(async (): Promise<boolean> => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.error('Microphone permission not granted');
      return false;
    }

    // Check if already recording
    if (recordingRef.current) {
      console.log('Already recording, skipping');
      return false;
    }

    try {
      const { Audio } = await import('expo-av');
      
      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Create recording instance
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        recordingUri: null,
      });

      // Start duration timer
      durationTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState((prev) => ({ ...prev, duration: elapsed }));
      }, 1000);

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }, [])

  const pauseRecording = useCallback(async (): Promise<void> => {
    if (!recordingRef.current || !state.isRecording || state.isPaused) return;

    try {
      await recordingRef.current.pauseAsync();
      pausedDurationRef.current = Date.now() - startTimeRef.current;
      
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      setState((prev) => ({ ...prev, isPaused: true }));
    } catch (error) {
      console.error('Failed to pause recording:', error);
    }
  }, [state.isRecording, state.isPaused]);

  const resumeRecording = useCallback(async (): Promise<void> => {
    if (!recordingRef.current || !state.isRecording || !state.isPaused) return;

    try {
      await recordingRef.current.startAsync();
      startTimeRef.current = Date.now() - pausedDurationRef.current;

      // Resume duration timer
      durationTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState((prev) => ({ ...prev, duration: elapsed }));
      }, 1000);

      setState((prev) => ({ ...prev, isPaused: false }));
    } catch (error) {
      console.error('Failed to resume recording:', error);
    }
  }, [state.isRecording, state.isPaused]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    try {
      const { Audio } = await import('expo-av');
      
      // Stop timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      recordingRef.current = null;

      setState((prev) => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        recordingUri: uri,
      }));

      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return null;
    }
  }, []);

  const cancelRecording = useCallback(async (): Promise<void> => {
    if (!recordingRef.current) return;

    try {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;

      setState({
        isRecording: false,
        isPaused: false,
        duration: 0,
        recordingUri: null,
      });
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  }, []);

  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    ...state,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    formatDuration,
  };
};
