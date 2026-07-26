import { noteToFrequency } from '../lib/noteUtils';
import { exerciseDuration } from '../lib/exerciseTiming';
import type { Exercise } from '../lib/exercises';

/**
 * Schedules the exercise's note sequence on an oscillator as the audible reference tone.
 * Returns the oscillator so the caller can stop it early if the user cancels.
 */
export function playExerciseTone(audioContext: AudioContext, exercise: Exercise): OscillatorNode {
  const oscillator = audioContext.createOscillator();
  oscillator.type = 'sine';

  const gain = audioContext.createGain();
  gain.gain.value = 0.15; // quiet reference tone — it should not drown out the singer's own ears

  oscillator.connect(gain).connect(audioContext.destination);

  const startTime = audioContext.currentTime;
  exercise.notes.forEach((note) => {
    oscillator.frequency.setValueAtTime(noteToFrequency(note.midiNumber), startTime + note.startTime);
  });

  oscillator.start(startTime);
  oscillator.stop(startTime + exerciseDuration(exercise));

  return oscillator;
}
