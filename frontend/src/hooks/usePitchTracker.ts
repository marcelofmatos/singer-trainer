import { useEffect, useRef, useState } from 'react';
import { DEFAULT_THRESHOLD, detectPitchYIN } from '../lib/pitchDetection';
import { frequencyToNote, type NoteInfo } from '../lib/noteUtils';

export type PitchTrackerStatus = 'requesting' | 'listening' | 'error';

export interface PitchTrackerState {
  status: PitchTrackerStatus;
  errorMessage: string | null;
  currentNote: NoteInfo | null;
}

const BUFFER_SIZE = 4096;
const DETECTION_INTERVAL_MS = 50; // naive YIN is O(n^2); 20Hz updates keep CPU sane and still look real-time

/**
 * Listens to the microphone and reports the detected note ~20 times/sec until unmounted.
 *
 * `sensitivity` is the YIN detection threshold: lower = stricter (fewer false positives
 * on noise/breath, but may miss soft/unclear pitches), higher = more lenient. It's read
 * via a ref inside the polling loop so adjusting it never re-requests microphone access
 * or tears down the existing audio graph.
 */
export function usePitchTracker(sensitivity: number = DEFAULT_THRESHOLD): PitchTrackerState {
  const [state, setState] = useState<PitchTrackerState>({
    status: 'requesting',
    errorMessage: null,
    currentNote: null,
  });

  const sensitivityRef = useRef(sensitivity);
  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        setState((prev) => ({ ...prev, status: 'listening' }));

        intervalId = setInterval(() => {
          analyser.getFloatTimeDomainData(buffer);
          const result = detectPitchYIN(buffer, audioContext!.sampleRate, sensitivityRef.current);
          setState((prev) => ({
            ...prev,
            currentNote: result ? frequencyToNote(result.frequency) : null,
          }));
        }, DETECTION_INTERVAL_MS);
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            errorMessage:
              err instanceof Error ? err.message : 'Não foi possível acessar o microfone.',
            currentNote: null,
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
  }, []);

  return state;
}
