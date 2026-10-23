import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES, buildDescendingRepeatedScale, buildScale } from './exercises';

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

describe('buildDescendingRepeatedScale', () => {
  it('repeats each interval, descending, before stepping to the next', () => {
    const notes = buildDescendingRepeatedScale(60, [0, 2, 4], 2, 1);
    // descending: 4, 4, 2, 2, 0, 0 (each interval repeated twice)
    expect(notes.map((n) => n.midiNumber)).toEqual([64, 64, 62, 62, 60, 60]);
  });

  it('assigns sequential, non-overlapping start times', () => {
    const notes = buildDescendingRepeatedScale(60, [0, 2, 4], 2, 0.5);
    expect(notes.map((n) => n.startTime)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
    notes.forEach((note) => expect(note.duration).toBe(0.5));
  });

  it('produces intervals.length * repeats notes', () => {
    const notes = buildDescendingRepeatedScale(60, [0, 2, 3, 5, 7, 8, 10, 12], 3, 0.4);
    expect(notes.length).toBe(24);
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

  it('gives every exercise a unique id and, unless it is a reference or free exercise, at least one note', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    BUILTIN_EXERCISES.filter((exercise) => exercise.mode !== 'reference' && exercise.mode !== 'free').forEach((exercise) => {
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

  it('includes the minor scale and stepped-descent minor scale exercises', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    expect(ids).toContain('escala-menor-c4');
    expect(ids).toContain('escala-menor-degraus');
  });

  it('includes the audio-input reference exercise, which has no notes of its own', () => {
    const exercise = BUILTIN_EXERCISES.find((e) => e.id === 'entrada-de-audio');
    expect(exercise).toMatchObject({ name: 'Entrada de áudio', mode: 'reference', notes: [] });
    expect(exercise?.description).toContain('Monitor of');
  });

  it('includes the free exercise, which has no notes of its own', () => {
    const exercise = BUILTIN_EXERCISES.find((e) => e.id === 'livre');
    expect(exercise).toMatchObject({ name: 'Exercício livre', mode: 'free', notes: [] });
    expect(exercise?.description).toContain('outra aba');
    expect(exercise?.description).toContain('fone');
  });
});
