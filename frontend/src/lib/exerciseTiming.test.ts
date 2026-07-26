import { describe, expect, it } from 'vitest';
import { exerciseDuration, noteAtTime } from './exerciseTiming';
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
