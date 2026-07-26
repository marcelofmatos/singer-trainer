import { describe, expect, it } from 'vitest';
import { frequencyToNote, noteToFrequency } from './noteUtils';

describe('frequencyToNote', () => {
  it('identifies A4 (440Hz) with 0 cents', () => {
    const note = frequencyToNote(440);
    expect(note.noteName).toBe('A');
    expect(note.octave).toBe(4);
    expect(note.midiNumber).toBe(69);
    expect(note.cents).toBe(0);
  });

  it('identifies C4 (middle C, 261.63Hz)', () => {
    const note = frequencyToNote(261.63);
    expect(note.noteName).toBe('C');
    expect(note.octave).toBe(4);
    expect(note.midiNumber).toBe(60);
  });

  it('reports positive cents when singing sharp', () => {
    // ~38 cents above A4
    const note = frequencyToNote(450);
    expect(note.noteName).toBe('A');
    expect(note.cents).toBeGreaterThan(30);
    expect(note.cents).toBeLessThan(45);
  });

  it('reports negative cents when singing flat', () => {
    // ~38 cents below A4
    const note = frequencyToNote(430);
    expect(note.noteName).toBe('A');
    expect(note.cents).toBeLessThan(-30);
    expect(note.cents).toBeGreaterThan(-45);
  });
});

describe('noteToFrequency', () => {
  it('converts MIDI 69 (A4) to 440Hz', () => {
    expect(noteToFrequency(69)).toBeCloseTo(440, 5);
  });

  it('converts MIDI 60 (C4) to ~261.63Hz', () => {
    expect(noteToFrequency(60)).toBeCloseTo(261.63, 1);
  });

  it('round-trips through frequencyToNote', () => {
    const freq = noteToFrequency(64); // E4
    const note = frequencyToNote(freq);
    expect(note.midiNumber).toBe(64);
    expect(note.cents).toBe(0);
  });
});
