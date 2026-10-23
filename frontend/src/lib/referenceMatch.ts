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

/** From `time` on, the reference hears `note` (null = silence). */
export interface ReferenceChange {
  time: number;
  note: { midi: number; cents: number } | null;
}

/** Appends a change, dropping those that ended more than `keepMs` before it (the one in force then stays). */
export function pushReferenceChange(log: ReferenceChange[], change: ReferenceChange, keepMs: number): ReferenceChange[] {
  const next = [...log, change];
  const cutoff = change.time - keepMs;
  let first = 0;
  while (first < next.length - 1 && next[first + 1].time < cutoff) first += 1;
  return next.slice(first);
}

/** The reference's note in force at `time`, null in silence or before the log starts. */
export function referenceNoteAt(log: ReferenceChange[], time: number): ReferenceChange['note'] {
  let note: ReferenceChange['note'] = null;
  for (const change of log) {
    if (change.time > time) break;
    note = change.note;
  }
  return note;
}

/** The notes heard during [at − toleranceMs, at], each stamped with when it stopped (at most `at`), for matchesReference. */
export function referenceSamplesAt(log: ReferenceChange[], at: number, toleranceMs: number): ReferenceSample[] {
  return log.flatMap((change, index) => {
    if (!change.note || change.time > at) return [];
    const end = Math.min(log[index + 1]?.time ?? at, at);
    return end < at - toleranceMs ? [] : [{ time: end, midi: change.note.midi, cents: change.note.cents }];
  });
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

/**
 * First lane whose device looks like a system monitor, else the first extra lane (new lanes are
 * appended, so adding one doesn't move this fallback); never the primary.
 */
export function defaultReferenceLaneId(laneIds: string[], labelOf: (laneId: string) => string): string | null {
  const extras = laneIds.slice(1);
  return extras.find((laneId) => labelOf(laneId).startsWith('Monitor of')) ?? extras[0] ?? null;
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
