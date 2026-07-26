// frontend/src/components/ExercisePlayer.tsx
import { useEffect, useState } from 'react';
import type { Exercise } from '../lib/exercises';
import { noteAtTime } from '../lib/exerciseTiming';
import { playExerciseTone } from '../audio/referenceTone';
import { usePitchTracker } from '../hooks/usePitchTracker';
import { PitchMeter } from './PitchMeter';

export interface ExercisePlayerProps {
  exercise: Exercise;
  onExit: () => void;
}

export function ExercisePlayer({ exercise, onExit }: ExercisePlayerProps) {
  const [elapsed, setElapsed] = useState(0);
  const pitchTracker = usePitchTracker();

  useEffect(() => {
    const audioContext = new AudioContext();
    const oscillator = playExerciseTone(audioContext, exercise);

    const startedAt = performance.now();
    const elapsedTimer = setInterval(() => {
      setElapsed((performance.now() - startedAt) / 1000);
    }, 100);

    return () => {
      clearInterval(elapsedTimer);
      oscillator.stop();
      audioContext.close();
    };
  }, [exercise]);

  const targetNote = noteAtTime(exercise, elapsed);

  return (
    <section>
      <h2>{exercise.name}</h2>
      <p>{exercise.description}</p>

      {pitchTracker.status === 'requesting' && <p>Pedindo acesso ao microfone…</p>}
      {pitchTracker.status === 'error' && (
        <p role="alert">Erro ao acessar o microfone: {pitchTracker.errorMessage}</p>
      )}
      {pitchTracker.status === 'listening' && (
        <PitchMeter
          detectedNote={pitchTracker.currentNote}
          targetMidiNumber={targetNote?.midiNumber ?? null}
        />
      )}

      <button onClick={onExit}>Voltar</button>
    </section>
  );
}
