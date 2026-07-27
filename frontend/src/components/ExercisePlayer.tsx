// frontend/src/components/ExercisePlayer.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise } from '../lib/exercises';
import { exerciseDuration, noteAtTime, scaleExerciseTiming } from '../lib/exerciseTiming';
import { playExerciseTone } from '../audio/referenceTone';
import { usePitchTracker } from '../hooks/usePitchTracker';
import { PitchMeter } from './PitchMeter';

export interface ExercisePlayerProps {
  exercise: Exercise;
}

const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2;
const PLAYBACK_RATE_STEP = 0.25;
const DEFAULT_PLAYBACK_RATE = 1;

export function ExercisePlayer({ exercise }: ExercisePlayerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_PLAYBACK_RATE);
  const [loop, setLoop] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [toneError, setToneError] = useState<string | null>(null);
  const pitchTracker = usePitchTracker();

  // Read via a ref inside the effect below so toggling "loop" mid-playback doesn't
  // restart the currently-playing cycle — it only decides what happens once the
  // *current* cycle naturally ends.
  const loopRef = useRef(loop);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const scaledExercise = useMemo(
    () => scaleExerciseTiming(exercise, playbackRate),
    [exercise, playbackRate]
  );

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let oscillator: OscillatorNode | null = null;
    let elapsedTimer: ReturnType<typeof setInterval> | null = null;
    let loopTimeout: ReturnType<typeof setTimeout> | null = null;

    try {
      audioContext = new AudioContext();
      oscillator = playExerciseTone(audioContext, scaledExercise);
      setToneError(null);

      const startedAt = performance.now();
      elapsedTimer = setInterval(() => {
        setElapsed((performance.now() - startedAt) / 1000);
      }, 100);

      loopTimeout = setTimeout(() => {
        if (loopRef.current) {
          setCycle((c) => c + 1);
        }
      }, exerciseDuration(scaledExercise) * 1000);
    } catch (err) {
      setToneError(
        err instanceof Error ? err.message : 'Não foi possível reproduzir o áudio de referência.'
      );
    }

    return () => {
      if (elapsedTimer) clearInterval(elapsedTimer);
      if (loopTimeout) clearTimeout(loopTimeout);
      oscillator?.stop();
      audioContext?.close();
    };
  }, [scaledExercise, cycle]);

  const targetNote = noteAtTime(scaledExercise, elapsed);

  return (
    <section className="exercise-panel">
      <h2 className="exercise-title">{exercise.name}</h2>
      <p className="exercise-description">{exercise.description}</p>

      {pitchTracker.status === 'requesting' && (
        <p className="status-message">Pedindo acesso ao microfone…</p>
      )}
      {pitchTracker.status === 'error' && (
        <p className="status-message" role="alert">
          Erro ao acessar o microfone: {pitchTracker.errorMessage}
        </p>
      )}
      {toneError && (
        <p className="status-message" role="alert">
          Erro ao tocar o áudio de referência: {toneError}
        </p>
      )}

      <div className="wheel-stage">
        <PitchMeter
          detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
          targetMidiNumber={targetNote?.midiNumber ?? null}
        />
      </div>

      <div className="exercise-controls">
        <label className="speed-control">
          Velocidade
          <input
            type="range"
            min={MIN_PLAYBACK_RATE}
            max={MAX_PLAYBACK_RATE}
            step={PLAYBACK_RATE_STEP}
            value={playbackRate}
            onChange={(event) => setPlaybackRate(Number(event.target.value))}
          />
          <span className="speed-value">{playbackRate.toFixed(2)}x</span>
        </label>

        <label className="loop-toggle">
          <input
            type="checkbox"
            checked={loop}
            onChange={(event) => setLoop(event.target.checked)}
          />
          Repetir
        </label>
      </div>
    </section>
  );
}
