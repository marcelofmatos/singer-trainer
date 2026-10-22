import { useEffect, useRef, useState } from 'react';
import { DEFAULT_THRESHOLD, detectPitchYIN } from '../lib/pitchDetection';
import { frequencyToNote, type NoteInfo } from '../lib/noteUtils';
import { downsampleWaveform } from '../lib/waveformSampling';

export type PitchTrackerStatus = 'requesting' | 'listening' | 'error' | 'off';

export interface PitchTrackerState {
  status: PitchTrackerStatus;
  errorMessage: string | null;
  currentNote: NoteInfo | null;
  /** Rolling window of downsampled signed amplitude values, oldest first, range [-1, 1]. */
  waveform: number[];
  /** Label of the active microphone while listening; null when unknown, off or failed. */
  deviceName: string | null;
  /** deviceId of the microphone actually in use while listening; null otherwise. */
  deviceId: string | null;
}

const BUFFER_SIZE = 4096;
const DETECTION_INTERVAL_MS = 50; // naive YIN is O(n^2); 20Hz updates keep CPU sane and still look real-time
const POINTS_PER_TICK = 8;
const WINDOW_SECONDS = 4;
const WINDOW_POINTS = (WINDOW_SECONDS * 1000 / DETECTION_INTERVAL_MS) * POINTS_PER_TICK; // 640

/**
 * Listens to the microphone and reports the detected note and a rolling waveform buffer
 * ~20 times/sec while `enabled`. Turning `enabled` off releases the stream (the browser's
 * recording indicator goes away) and reports status 'off'; turning it back on reopens it.
 *
 * `sensitivity` is the YIN detection threshold: lower = stricter (fewer false positives
 * on noise/breath, but may miss soft/unclear pitches), higher = more lenient. It's read
 * via a ref inside the polling loop so adjusting it never re-requests microphone access
 * or tears down the existing audio graph.
 *
 * `deviceId` picks the microphone; when it isn't connected the system default is used
 * instead. If the open track ends (e.g. the microphone is unplugged) it is reopened.
 */
export function usePitchTracker(
  sensitivity: number = DEFAULT_THRESHOLD,
  enabled: boolean = true,
  deviceId: string | null = null
): PitchTrackerState {
  const [state, setState] = useState<PitchTrackerState>({
    status: enabled ? 'requesting' : 'off',
    errorMessage: null,
    currentNote: null,
    waveform: [],
    deviceName: null,
    deviceId: null,
  });

  const sensitivityRef = useRef(sensitivity);
  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  // Bumped when the open track ends, so the effect below reopens the microphone.
  const [reopenCount, setReopenCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'off', errorMessage: null, currentNote: null, waveform: [], deviceName: null, deviceId: null });
      return;
    }
    setState({ status: 'requesting', errorMessage: null, currentNote: null, waveform: [], deviceName: null, deviceId: null });

    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function openStream(): Promise<MediaStream> {
      if (!deviceId) return navigator.mediaDevices.getUserMedia({ audio: true });
      return navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } }).catch((err) => {
        // The chosen microphone isn't connected — fall back to the system default.
        const name = (err as { name?: string } | null)?.name;
        if (name === 'OverconstrainedError' || name === 'NotFoundError') {
          return navigator.mediaDevices.getUserMedia({ audio: true });
        }
        throw err;
      });
    }

    async function start() {
      try {
        stream = await openStream();
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = BUFFER_SIZE;
        source.connect(analyser);

        const buffer = new Float32Array(analyser.fftSize);
        const track = stream.getAudioTracks()[0];
        const deviceName = track?.label || null;
        const activeDeviceId = track?.getSettings?.().deviceId ?? null;
        track?.addEventListener('ended', () => {
          if (!cancelled) setReopenCount((count) => count + 1);
        });
        setState((prev) => ({ ...prev, status: 'listening', deviceName, deviceId: activeDeviceId }));

        intervalId = setInterval(() => {
          analyser.getFloatTimeDomainData(buffer);
          const result = detectPitchYIN(buffer, audioContext!.sampleRate, sensitivityRef.current);
          setState((prev) => ({
            ...prev,
            currentNote: result ? frequencyToNote(result.frequency) : null,
            waveform: [...prev.waveform, ...downsampleWaveform(buffer, POINTS_PER_TICK)].slice(-WINDOW_POINTS),
          }));
        }, DETECTION_INTERVAL_MS);
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            errorMessage:
              err instanceof Error ? err.message : 'Não foi possível acessar o microfone.',
            currentNote: null,
            waveform: [],
            deviceName: null,
            deviceId: null,
          });
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      stream?.getTracks().forEach((track) => track.stop());
      audioContext?.close();
    };
  }, [enabled, deviceId, reopenCount]);

  return state;
}
