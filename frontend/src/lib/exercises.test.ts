import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES, buildScale } from './exercises';

describe('buildScale', () => {
  it('builds an up-and-down sequence from root + intervals', () => {
    const notes = buildScale(60, [0, 2, 4], 1);
    // up: 60, 62, 64 — down: 62, 60 (last-note-of-up not repeated)
    expect(notes.map((n) => n.midiNumber)).toEqual([60, 62, 64, 62, 60]);
  });

  it('assigns sequential, non-overlapping start times', () => {
    const notes = buildScale(60, [0, 2, 4], 0.5);
    expect(notes.map((n) => n.startTime)).toEqual([0, 0.5, 1, 1.5, 2]);
    notes.forEach((note) => expect(note.duration).toBe(0.5));
  });
});

describe('BUILTIN_EXERCISES', () => {
  it('has at least 4 exercises covering warmup, scale and breathing categories', () => {
    expect(BUILTIN_EXERCISES.length).toBeGreaterThanOrEqual(4);
    const categories = new Set(BUILTIN_EXERCISES.map((e) => e.category));
    expect(categories.has('escala')).toBe(true);
    expect(categories.has('aquecimento')).toBe(true);
    expect(categories.has('respiracao')).toBe(true);
  });

  it('gives every exercise a unique id and at least one note', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    BUILTIN_EXERCISES.forEach((exercise) => {
      expect(exercise.notes.length).toBeGreaterThan(0);
    });
  });

  it('keeps every exercise note sequence sorted by start time', () => {
    BUILTIN_EXERCISES.forEach((exercise) => {
      for (let i = 1; i < exercise.notes.length; i++) {
        expect(exercise.notes[i].startTime).toBeGreaterThanOrEqual(exercise.notes[i - 1].startTime);
      }
    });
  });

  it('includes the arpeggio, 5-tone scale, and octave-jump warmup exercises', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    expect(ids).toContain('arpejo-maior-c4');
    expect(ids).toContain('escala-cinco-notas');
    expect(ids).toContain('saltos-oitava');
  });
});
