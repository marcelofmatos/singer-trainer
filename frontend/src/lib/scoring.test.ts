// frontend/src/lib/scoring.test.ts
import { describe, expect, it } from 'vitest';
import { addSample, addTallies, EMPTY_TALLY, formatSeconds, hitPercent, isHit } from './scoring';

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
