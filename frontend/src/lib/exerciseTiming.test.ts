import { describe, expect, it } from 'vitest';
import { exerciseDuration, noteAtTime, scaleExerciseTiming } from './exerciseTiming';
import type { Exercise } from './exercises';

const SAMPLE_EXERCISE: Exercise = {
  id: 'sample',
  name: 'Sample',
  category: 'escala',
  description: 'test fixture',
  notes: [
    { midiNumber: 60, startTime: 0, duration: 1 },
    { midiNumber: 62, startTime: 1, duration: 1 },
    { midiNumber: 64, startTime: 2, duration: 1 },
  ],
};

describe('exerciseDuration', () => {
  it('returns the end time of the last note', () => {
    expect(exerciseDuration(SAMPLE_EXERCISE)).toBe(3);
  });
});

describe('noteAtTime', () => {
  it('returns the note active at a given elapsed time', () => {
    expect(noteAtTime(SAMPLE_EXERCISE, 0)?.midiNumber).toBe(60);
    expect(noteAtTime(SAMPLE_EXERCISE, 1.5)?.midiNumber).toBe(62);
    expect(noteAtTime(SAMPLE_EXERCISE, 2.9)?.midiNumber).toBe(64);
  });

  it('returns null once the exercise has ended', () => {
    expect(noteAtTime(SAMPLE_EXERCISE, 3)).toBeNull();
    expect(noteAtTime(SAMPLE_EXERCISE, 10)).toBeNull();
  });

  it('returns null before the exercise starts', () => {
    expect(noteAtTime(SAMPLE_EXERCISE, -1)).toBeNull();
  });
});

describe('scaleExerciseTiming', () => {
  it('shrinks note timings when the rate is greater than 1 (faster)', () => {
    const scaled = scaleExerciseTiming(SAMPLE_EXERCISE, 2);
    expect(scaled.notes.map((n) => n.startTime)).toEqual([0, 0.5, 1]);
    expect(scaled.notes.map((n) => n.duration)).toEqual([0.5, 0.5, 0.5]);
  });

  it('stretches note timings when the rate is less than 1 (slower)', () => {
    const scaled = scaleExerciseTiming(SAMPLE_EXERCISE, 0.5);
    expect(scaled.notes.map((n) => n.startTime)).toEqual([0, 2, 4]);
    expect(scaled.notes.map((n) => n.duration)).toEqual([2, 2, 2]);
  });

  it('leaves timings unchanged at rate 1', () => {
    const scaled = scaleExerciseTiming(SAMPLE_EXERCISE, 1);
    expect(scaled.notes).toEqual(SAMPLE_EXERCISE.notes);
  });

  it('preserves every other exercise field', () => {
    const scaled = scaleExerciseTiming(SAMPLE_EXERCISE, 2);
    expect(scaled.id).toBe(SAMPLE_EXERCISE.id);
    expect(scaled.name).toBe(SAMPLE_EXERCISE.name);
    expect(scaled.category).toBe(SAMPLE_EXERCISE.category);
    expect(scaled.description).toBe(SAMPLE_EXERCISE.description);
  });
});
