// frontend/src/lib/scoring.ts
import type { NoteInfo } from './noteUtils';

/** Same tolerance as the green "in tune" color of the live indicator. */
export const HIT_TOLERANCE_CENTS = 10;

export interface ScoreTally {
  /** Seconds during which there was a target note to sing. */
  targetSeconds: number;
  /** Of those, seconds sung in tune. */
  hitSeconds: number;
}

export const EMPTY_TALLY: ScoreTally = { targetSeconds: 0, hitSeconds: 0 };

/** True when the detected note matches the target's pitch class within the tolerance, in any octave. */
export function isHit(detected: NoteInfo | null, targetMidi: number | null): boolean {
  if (!detected || targetMidi === null) return false;
  const semitones = detected.midiNumber - targetMidi;
  const wrapped = ((((semitones % 12) + 18) % 12) - 6); // nearest octave, in [-6, 6)
  return Math.abs(wrapped * 100 + detected.cents) <= HIT_TOLERANCE_CENTS;
}

/** Free singing: in tune when within the tolerance of the nearest note. */
export function isHitNearest(detected: NoteInfo | null): boolean {
  return detected !== null && Math.abs(detected.cents) <= HIT_TOLERANCE_CENTS;
}

export function addSample(tally: ScoreTally, seconds: number, hit: boolean): ScoreTally {
  return {
    targetSeconds: tally.targetSeconds + seconds,
    hitSeconds: tally.hitSeconds + (hit ? seconds : 0),
  };
}

export function addTallies(a: ScoreTally, b: ScoreTally): ScoreTally {
  return { targetSeconds: a.targetSeconds + b.targetSeconds, hitSeconds: a.hitSeconds + b.hitSeconds };
}

/** One tally per pitch class (0 = C … 11 = B). */
export type NoteTallies = ScoreTally[];

export const EMPTY_NOTE_TALLIES: NoteTallies = Array.from({ length: 12 }, () => EMPTY_TALLY);

export function addNoteSample(tallies: NoteTallies, midiNumber: number, seconds: number, hit: boolean): NoteTallies {
  const pitchClass = ((midiNumber % 12) + 12) % 12;
  return tallies.map((tally, index) => (index === pitchClass ? addSample(tally, seconds, hit) : tally));
}

export function addNoteTallies(a: NoteTallies, b: NoteTallies): NoteTallies {
  return a.map((tally, index) => addTallies(tally, b[index]));
}

export function hitPercent(tally: ScoreTally): number {
  return tally.targetSeconds > 0 ? Math.round((tally.hitSeconds / tally.targetSeconds) * 100) : 0;
}

/** "48,2 s" below a minute, "12 min 05 s" from a minute on. */
export function formatSeconds(seconds: number): string {
  const tenths = Math.round(seconds * 10) / 10;
  if (tenths < 60) {
    return `${tenths.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
  }
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)} min ${String(whole % 60).padStart(2, '0')} s`;
}
