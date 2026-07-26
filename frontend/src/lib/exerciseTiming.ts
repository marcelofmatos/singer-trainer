import type { Exercise, ExerciseNote } from './exercises';

/** Total duration of an exercise, in seconds, from the end time of its last note. */
export function exerciseDuration(exercise: Exercise): number {
  return exercise.notes.reduce((max, note) => Math.max(max, note.startTime + note.duration), 0);
}

/** Finds the note that should be sounding at a given elapsed time, or null if none is. */
export function noteAtTime(exercise: Exercise, elapsedSeconds: number): ExerciseNote | null {
  const match = exercise.notes.find(
    (note) => elapsedSeconds >= note.startTime && elapsedSeconds < note.startTime + note.duration
  );
  return match ?? null;
}
