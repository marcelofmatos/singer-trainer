import { centsToGaugePercent, tuningStatus } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';

export interface PitchMeterProps {
  detectedNote: NoteInfo | null;
  /** The exercise's current target note, if one is playing. */
  targetMidiNumber: number | null;
}

export function PitchMeter({ detectedNote, targetMidiNumber }: PitchMeterProps) {
  const label = detectedNote ? `${detectedNote.noteName}${detectedNote.octave}` : '—';

  // Cents relative to the exercise's target note (if any), otherwise relative to the
  // nearest chromatic note — i.e. plain-tuner mode.
  const cents =
    detectedNote && targetMidiNumber !== null
      ? Math.round((detectedNote.midiNumber - targetMidiNumber) * 100 + detectedNote.cents)
      : (detectedNote?.cents ?? 0);

  const status = detectedNote ? tuningStatus(cents) : null;
  const gaugePercent = centsToGaugePercent(cents);

  return (
    <div>
      <p style={{ fontSize: '3rem', margin: 0, textAlign: 'center' }}>{label}</p>
      <div
        style={{
          position: 'relative',
          height: '1rem',
          background: 'linear-gradient(to right, #d33, #3a3, #d33)',
          borderRadius: '999px',
        }}
      >
        <div
          data-testid="tuning-needle"
          data-status={status ?? 'none'}
          style={{
            position: 'absolute',
            left: `${gaugePercent}%`,
            top: '-0.25rem',
            width: '0.25rem',
            height: '1.5rem',
            background: 'black',
            transform: 'translateX(-50%)',
          }}
        />
      </div>
    </div>
  );
}
