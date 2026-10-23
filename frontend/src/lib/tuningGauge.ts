import type { NoteInfo } from './noteUtils';

export type TuningStatus = 'in-tune' | 'close' | 'off';

export const STATUS_COLORS: Record<TuningStatus, string> = {
  'in-tune': '#2ecc71',
  close: '#f1c40f',
  off: '#e74c3c',
};

/** Maps a cents deviation to a 0-100 horizontal gauge position (50 = perfectly in tune). */
export function centsToGaugePercent(cents: number, maxCents = 50): number {
  const clamped = Math.max(-maxCents, Math.min(maxCents, cents));
  return ((clamped + maxCents) / (2 * maxCents)) * 100;
}

/** Classifies a cents deviation into a tuning status for color-coding the UI. */
export function tuningStatus(cents: number): TuningStatus {
  const abs = Math.abs(cents);
  if (abs <= 10) return 'in-tune';
  if (abs <= 25) return 'close';
  return 'off';
}

/**
 * Derives the tuning status for a detected note, relative to an exercise's target note
 * (if any) or the nearest chromatic note otherwise — same cents math both PitchMeter's
 * ring indicator and the Waveform trace color themselves by.
 */
export function statusForNote(
  detectedNote: NoteInfo | null,
  targetMidiNumber: number | null
): TuningStatus | null {
  if (!detectedNote) return null;
  const cents =
    targetMidiNumber !== null
      ? (detectedNote.midiNumber - targetMidiNumber) * 100 + detectedNote.cents
      : detectedNote.cents;
  return tuningStatus(cents);
}

/**
 * Tuning status of a detected note against the target pitch class in any octave (same rule
 * as the score), or against the nearest note when there is no target.
 */
export function statusForPitch(detectedNote: NoteInfo | null, targetMidiNumber: number | null): TuningStatus | null {
  if (!detectedNote) return null;
  if (targetMidiNumber === null) return tuningStatus(detectedNote.cents);
  const semitones = detectedNote.midiNumber - targetMidiNumber;
  const wrapped = ((((semitones % 12) + 18) % 12) - 6);
  return tuningStatus(wrapped * 100 + detectedNote.cents);
}
