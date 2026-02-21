import { useState, useCallback, useRef, useEffect } from 'react';
import {
  RecordingPresets,
  RecordingOptions,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  recordingUri: string | null;
}

// Use a simple class-based recorder that doesn't auto-manage lifecycle
class VoiceRecorder {
  private recorder: InstanceType<typeof AudioModule['AudioRecorder']> | null = null;
  private isRecording = false;
  private uri: string | null = null;

  async prepare(options: RecordingOptions) {
    // Create recorder using the AudioRecorder constructor from the module
    const AudioRecorderClass = AudioModule.AudioRecorder;
    this.recorder = new AudioRecorderClass(options);
  }

  record() {
    if (this.recorder) {
      this.recorder.record();
      this.isRecording = true;
    }
  }

  pause() {
    if (this.recorder) {
      this.recorder.pause();
    }
  }

  async stop(): Promise<string | null> {
    if (this.recorder) {
      await this.recorder.stop();
      this.isRecording = false;
      this.uri = this.recorder.uri || null;
      return this.uri;
    }
    return null;
  }

  get isRecordingActive() {
    return this.isRecording;
  }

  get currentUri() {
    return this.uri;
  }
}

export const useVoiceRecorder = (recordingOptions?: RecordingOptions) => {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    recordingUri: null,
  });

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  // Set up audio mode when component mounts
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    });
  }, []);

  const requestPermissions = async (): Promise<boolean> => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    return status.granted;
  };

  const startRecording = useCallback(async (): Promise<boolean> => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.error('Microphone permission not granted');
      return false;
    }

    // Check if already recording
    if (state.isRecording) {
      console.log('Already recording, skipping');
      return false;
    }

    try {
      // Create new recorder instance
      const recorder = new VoiceRecorder();
      await recorder.prepare(recordingOptions ?? RecordingPresets.HIGH_QUALITY);
      recorder.record();
      recorderRef.current = recorder;

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
  }, [recordingOptions, state.isRecording]);

  const pauseRecording = useCallback(async (): Promise<void> => {
    if (!state.isRecording || state.isPaused) return;

    try {
      recorderRef.current?.pause();
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
    if (!state.isRecording || !state.isPaused) return;

    try {
      recorderRef.current?.record();
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
    if (!state.isRecording) return state.recordingUri;

    try {
      // Stop timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      // Stop recording
      const uri = await recorderRef.current?.stop() || null;

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
  }, [state.isRecording, state.recordingUri]);

  const cancelRecording = useCallback(async (): Promise<void> => {
    if (!state.isRecording) return;

    try {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      await recorderRef.current?.stop();

      setState({
        isRecording: false,
        isPaused: false,
        duration: 0,
        recordingUri: null,
      });
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  }, [state.isRecording]);

  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
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
