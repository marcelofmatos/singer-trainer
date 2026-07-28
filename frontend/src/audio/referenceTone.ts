import { noteToFrequency } from '../lib/noteUtils';
import { exerciseDuration } from '../lib/exerciseTiming';
import type { Exercise } from '../lib/exercises';

/** Quiet reference tone — it should not drown out the singer's own ears. */
export const REFERENCE_TONE_GAIN = 0.15;

export interface ReferenceTonePlayback {
  oscillator: OscillatorNode;
  gain: GainNode;
}

/**
 * Schedules the exercise's note sequence on an oscillator as the audible reference tone.
 * Returns the oscillator (so the caller can stop it early) and the gain node (so the
 * caller can mute/unmute it) — creating both once and handing back live references
 * rather than only playing the tone as a fire-and-forget side effect.
 */
export function playExerciseTone(audioContext: AudioContext, exercise: Exercise): ReferenceTonePlayback {
  const oscillator = audioContext.createOscillator();
  oscillator.type = 'sine';

  const gain = audioContext.createGain();
  gain.gain.value = REFERENCE_TONE_GAIN;

  oscillator.connect(gain).connect(audioContext.destination);

  const startTime = audioContext.currentTime;
  exercise.notes.forEach((note) => {
    oscillator.frequency.setValueAtTime(noteToFrequency(note.midiNumber), startTime + note.startTime);
  });

  oscillator.start(startTime);
  oscillator.stop(startTime + exerciseDuration(exercise));

  return { oscillator, gain };
}
