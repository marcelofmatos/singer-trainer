import type { NoteInfo } from './noteUtils';
import { HIT_TOLERANCE_CENTS } from './scoring';

/** One pitch reading of the reference input. */
export interface ReferenceSample {
  /** Milliseconds (monotonic). */
  time: number;
  midi: number;
  cents: number;
}

/** How far back a reference note still counts, to absorb reaction time and audio latency. */
export const REFERENCE_TOLERANCE_MS = 500;

const STORAGE_KEY = 'singer-trainer:reference-lane';

export function pushReferenceSample(history: ReferenceSample[], sample: ReferenceSample, windowMs: number): ReferenceSample[] {
  return [...history, sample].filter((entry) => entry.time >= sample.time - windowMs);
}

/** True if the detected note matches, within ±10 cents in any octave, a reference sample from the last `toleranceMs`. */
export function matchesReference(
  detected: NoteInfo | null,
  history: ReferenceSample[],
  now: number,
  toleranceMs: number
): boolean {
  if (!detected) return false;
  return history.some((sample) => {
    if (sample.time < now - toleranceMs) return false;
    const semitones = detected.midiNumber - sample.midi;
    const wrapped = ((((semitones % 12) + 18) % 12) - 6);
    return Math.abs(wrapped * 100 + detected.cents - sample.cents) <= HIT_TOLERANCE_CENTS;
  });
}

/** First lane whose device looks like a system monitor, else the last extra lane; never the primary. */
export function defaultReferenceLaneId(laneIds: string[], labelOf: (laneId: string) => string): string | null {
  const extras = laneIds.slice(1);
  return extras.find((laneId) => labelOf(laneId).startsWith('Monitor of')) ?? extras[extras.length - 1] ?? null;
}

export function loadReferenceLaneId(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? stored : null;
  } catch {
    return null;
  }
}

export function saveReferenceLaneId(laneId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, laneId);
  } catch {
    // Private browsing / quota exceeded — the choice just won't be remembered.
  }
}
