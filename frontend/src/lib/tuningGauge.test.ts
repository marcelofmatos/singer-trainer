import { describe, expect, it } from 'vitest';
import { centsToGaugePercent, STATUS_COLORS, statusForNote, statusForPitch, tuningStatus } from './tuningGauge';

describe('centsToGaugePercent', () => {
  it('maps 0 cents to the center (50%)', () => {
    expect(centsToGaugePercent(0)).toBe(50);
  });

  it('maps -50 cents (or below) to 0%', () => {
    expect(centsToGaugePercent(-50)).toBe(0);
    expect(centsToGaugePercent(-100)).toBe(0);
  });

  it('maps +50 cents (or above) to 100%', () => {
    expect(centsToGaugePercent(50)).toBe(100);
    expect(centsToGaugePercent(100)).toBe(100);
  });

  it('maps +25 cents to 75%', () => {
    expect(centsToGaugePercent(25)).toBe(75);
  });
});

describe('tuningStatus', () => {
  it('is "in-tune" within 10 cents', () => {
    expect(tuningStatus(0)).toBe('in-tune');
    expect(tuningStatus(10)).toBe('in-tune');
    expect(tuningStatus(-10)).toBe('in-tune');
  });

  it('is "close" between 10 and 25 cents, inclusive of the 25 boundary', () => {
    expect(tuningStatus(15)).toBe('close');
    expect(tuningStatus(-20)).toBe('close');
    expect(tuningStatus(25)).toBe('close');
    expect(tuningStatus(-25)).toBe('close');
  });

  it('is "off" beyond 25 cents', () => {
    expect(tuningStatus(30)).toBe('off');
    expect(tuningStatus(-40)).toBe('off');
  });
});

describe('STATUS_COLORS', () => {
  it('has a color for every tuning status', () => {
    expect(Object.keys(STATUS_COLORS).sort()).toEqual(['close', 'in-tune', 'off']);
  });
});

describe('statusForNote', () => {
  it('returns null when no note is detected', () => {
    expect(statusForNote(null, 69)).toBeNull();
    expect(statusForNote(null, null)).toBeNull();
  });

  it('is "in-tune" when within 10 cents of the target', () => {
    const note = { noteName: 'A', octave: 4, midiNumber: 69, cents: 3 };
    expect(statusForNote(note, 69)).toBe('in-tune');
  });

  it('is "off" when far from the target', () => {
    const note = { noteName: 'A', octave: 4, midiNumber: 69, cents: 40 };
    expect(statusForNote(note, 69)).toBe('off');
  });

  it('accounts for whole-semitone offsets from the target, not just cents', () => {
    const note = { noteName: 'G', octave: 4, midiNumber: 67, cents: 0 };
    expect(statusForNote(note, 69)).toBe('off');
  });

  it('falls back to nearest-chromatic-note tuning when there is no target', () => {
    const note = { noteName: 'A', octave: 4, midiNumber: 69, cents: -15 };
    expect(statusForNote(note, null)).toBe('close');
  });
});

describe('statusForPitch', () => {
  const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 4, midiNumber, cents });

  it('is null without a detected note', () => {
    expect(statusForPitch(null, 60)).toBeNull();
  });

  it('measures against the target in any octave', () => {
    expect(statusForPitch(note(48, 5), 60)).toBe('in-tune');
    expect(statusForPitch(note(72, 20), 60)).toBe('close');
    expect(statusForPitch(note(61, 0), 60)).toBe('off');
  });

  it('measures against the nearest note without a target', () => {
    expect(statusForPitch(note(65, -8), null)).toBe('in-tune');
    expect(statusForPitch(note(65, 30), null)).toBe('off');
  });
});
