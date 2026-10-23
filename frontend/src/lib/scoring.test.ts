// frontend/src/lib/scoring.test.ts
import { describe, expect, it } from 'vitest';
import {
  addNoteSample,
  addNoteTallies,
  addSample,
  addTallies,
  EMPTY_NOTE_TALLIES,
  EMPTY_TALLY,
  formatSeconds,
  hitPercent,
  isHit,
  isHitNearest,
} from './scoring';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 4, midiNumber, cents });

describe('isHit', () => {
  it('accepts the target note within ±10 cents', () => {
    expect(isHit(note(60, 0), 60)).toBe(true);
    expect(isHit(note(60, 10), 60)).toBe(true);
    expect(isHit(note(60, -10), 60)).toBe(true);
    expect(isHit(note(60, 11), 60)).toBe(false);
  });

  it('accepts the target note in any octave', () => {
    expect(isHit(note(48, 3), 60)).toBe(true);
    expect(isHit(note(72, -5), 60)).toBe(true);
  });

  it('rejects other notes, including neighbours across the octave boundary', () => {
    expect(isHit(note(61, 0), 60)).toBe(false);
    expect(isHit(note(59, 0), 60)).toBe(false);
    expect(isHit(note(71, 0), 60)).toBe(false);
  });

  it('counts a neighbouring note bent into tune as a hit', () => {
    expect(isHit(note(59, 95), 60)).toBe(true);
  });

  it('is never a hit without a detected note or a target', () => {
    expect(isHit(null, 60)).toBe(false);
    expect(isHit(note(60, 0), null)).toBe(false);
  });
});

describe('tallies', () => {
  it('adds target time always and hit time only on hits', () => {
    const tally = addSample(addSample(EMPTY_TALLY, 0.1, true), 0.1, false);
    expect(tally.targetSeconds).toBeCloseTo(0.2);
    expect(tally.hitSeconds).toBeCloseTo(0.1);
  });

  it('sums tallies', () => {
    expect(addTallies({ targetSeconds: 1, hitSeconds: 0.5 }, { targetSeconds: 2, hitSeconds: 1 })).toEqual({
      targetSeconds: 3,
      hitSeconds: 1.5,
    });
  });

  it('computes the hit percentage, 0 without target time', () => {
    expect(hitPercent({ targetSeconds: 3, hitSeconds: 2 })).toBe(67);
    expect(hitPercent(EMPTY_TALLY)).toBe(0);
  });
});

describe('formatSeconds', () => {
  it('uses one decimal below a minute and minutes above', () => {
    expect(formatSeconds(0)).toBe('0,0 s');
    expect(formatSeconds(48.24)).toBe('48,2 s');
    expect(formatSeconds(725)).toBe('12 min 05 s');
    expect(formatSeconds(59.96)).toBe('1 min 00 s');
  });
});

describe('isHitNearest', () => {
  it('accepts the nearest note within ±10 cents', () => {
    expect(isHitNearest(note(61, 0))).toBe(true);
    expect(isHitNearest(note(61, 10))).toBe(true);
    expect(isHitNearest(note(61, -10))).toBe(true);
    expect(isHitNearest(note(61, 11))).toBe(false);
    expect(isHitNearest(note(61, -11))).toBe(false);
  });

  it('is never a hit without a detected note', () => {
    expect(isHitNearest(null)).toBe(false);
  });
});

describe('per-note tallies', () => {
  it('starts with 12 empty tallies', () => {
    expect(EMPTY_NOTE_TALLIES).toHaveLength(12);
    EMPTY_NOTE_TALLIES.forEach((tally) => expect(tally).toEqual(EMPTY_TALLY));
  });

  it('adds a sample only to the pitch class of the note', () => {
    const hit = addNoteSample(EMPTY_NOTE_TALLIES, 62, 0.5, true);
    expect(hit).toHaveLength(12);
    expect(hit[2]).toEqual({ targetSeconds: 0.5, hitSeconds: 0.5 });
    hit.forEach((tally, index) => index === 2 || expect(tally).toEqual(EMPTY_TALLY));
    const miss = addNoteSample(hit, 74, 0.25, false);
    expect(miss[2]).toEqual({ targetSeconds: 0.75, hitSeconds: 0.5 });
    expect(EMPTY_NOTE_TALLIES[2]).toEqual(EMPTY_TALLY);
  });

  it('sums two sets of tallies per index', () => {
    const a = addNoteSample(EMPTY_NOTE_TALLIES, 60, 1, true);
    const b = addNoteSample(addNoteSample(EMPTY_NOTE_TALLIES, 60, 2, false), 71, 1, true);
    const sum = addNoteTallies(a, b);
    expect(sum[0]).toEqual({ targetSeconds: 3, hitSeconds: 1 });
    expect(sum[11]).toEqual({ targetSeconds: 1, hitSeconds: 1 });
  });
});
