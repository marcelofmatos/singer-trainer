import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultReferenceLaneId,
  loadReferenceLaneId,
  matchesReference,
  pushReferenceChange,
  referenceNoteAt,
  referenceSamplesAt,
  REFERENCE_TOLERANCE_MS,
  saveReferenceLaneId,
} from './referenceMatch';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 0, midiNumber, cents });

describe('reference change log', () => {
  const C = { midi: 60, cents: 0 };
  const D = { midi: 62, cents: 5 };
  // C from 1000 to 1300, D from 1300 to 1600, silence from 1600, E from 2000 on.
  const log = [
    { time: 1000, note: C },
    { time: 1300, note: D },
    { time: 1600, note: null },
    { time: 2000, note: { midi: 64, cents: 0 } },
  ];

  it('keeps the changes still relevant to the window, including the one in force at its start', () => {
    let history = pushReferenceChange([], { time: 0, note: C }, 500);
    history = pushReferenceChange(history, { time: 400, note: D }, 500);
    history = pushReferenceChange(history, { time: 900, note: null }, 500);
    expect(history.map((change) => change.time)).toEqual([0, 400, 900]);
    history = pushReferenceChange(history, { time: 1000, note: C }, 500);
    expect(history.map((change) => change.time)).toEqual([400, 900, 1000]);
  });

  it('tells the note in force at a time', () => {
    expect(referenceNoteAt(log, 999)).toBeNull();
    expect(referenceNoteAt(log, 1000)).toEqual(C);
    expect(referenceNoteAt(log, 1450)).toEqual(D);
    expect(referenceNoteAt(log, 1800)).toBeNull();
  });

  it('lists the notes heard in the tolerance window before a time, stamped with when they stopped', () => {
    expect(referenceSamplesAt(log, 1400, 500)).toEqual([
      { time: 1300, midi: 60, cents: 0 },
      { time: 1400, midi: 62, cents: 5 },
    ]);
    expect(referenceSamplesAt(log, 1900, 500)).toEqual([{ time: 1600, midi: 62, cents: 5 }]);
  });

  it('ignores notes that only start after the time', () => {
    expect(referenceSamplesAt(log, 1200, 500)).toEqual([{ time: 1200, midi: 60, cents: 0 }]);
    expect(referenceSamplesAt(log, 1999, 300)).toEqual([]);
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

  it('prefers a "Monitor of" lane, then the first extra lane, never the primary', () => {
    expect(defaultReferenceLaneId(['primary', 'lane-2', 'lane-3'], labelOf)).toBe('lane-3');
    expect(defaultReferenceLaneId(['primary', 'lane-2', 'lane-4'], labelOf)).toBe('lane-2');
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
