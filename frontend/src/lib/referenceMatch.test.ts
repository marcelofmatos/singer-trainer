import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultReferenceLaneId,
  loadReferenceLaneId,
  matchesReference,
  pushReferenceSample,
  REFERENCE_TOLERANCE_MS,
  saveReferenceLaneId,
} from './referenceMatch';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 0, midiNumber, cents });

describe('pushReferenceSample', () => {
  it('keeps only samples inside the window', () => {
    let history = pushReferenceSample([], { time: 0, midi: 60, cents: 0 }, 500);
    history = pushReferenceSample(history, { time: 400, midi: 62, cents: 0 }, 500);
    history = pushReferenceSample(history, { time: 900, midi: 64, cents: 0 }, 500);
    expect(history.map((sample) => sample.midi)).toEqual([62, 64]);
  });
});

describe('matchesReference', () => {
  const history = [
    { time: 1000, midi: 60, cents: 0 },
    { time: 1300, midi: 62, cents: 5 },
  ];

  it('accepts a note the reference sang within the tolerance, in any octave', () => {
    expect(REFERENCE_TOLERANCE_MS).toBe(500);
    expect(matchesReference(note(48, 4), history, 1400, 500)).toBe(true);
    expect(matchesReference(note(74, 0), history, 1400, 500)).toBe(true);
  });

  it('rejects notes beyond ±10 cents, other notes and samples older than the tolerance', () => {
    expect(matchesReference(note(62, 20), history, 1400, 500)).toBe(false);
    expect(matchesReference(note(65, 0), history, 1400, 500)).toBe(false);
    expect(matchesReference(note(60, 0), history, 1600, 500)).toBe(false);
  });

  it('never matches without a detected note or reference samples', () => {
    expect(matchesReference(null, history, 1400, 500)).toBe(false);
    expect(matchesReference(note(60, 0), [], 1400, 500)).toBe(false);
  });
});

describe('defaultReferenceLaneId', () => {
  const labelOf = (laneId: string) =>
    ({ primary: 'USB Mic', 'lane-2': 'JBL', 'lane-3': 'Monitor of JBL' })[laneId] ?? '';

  it('prefers a "Monitor of" lane, then the last extra lane, never the primary', () => {
    expect(defaultReferenceLaneId(['primary', 'lane-2', 'lane-3'], labelOf)).toBe('lane-3');
    expect(defaultReferenceLaneId(['primary', 'lane-2'], labelOf)).toBe('lane-2');
    expect(defaultReferenceLaneId(['primary'], labelOf)).toBeNull();
  });
});

describe('reference lane persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the chosen lane', () => {
    expect(loadReferenceLaneId()).toBeNull();
    saveReferenceLaneId('lane-3');
    expect(loadReferenceLaneId()).toBe('lane-3');
  });
});
