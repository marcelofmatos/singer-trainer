// frontend/src/components/SungNoteReadout.tsx
import { STATUS_COLORS, statusForPitch } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';
import { noteLabel } from './TunerView';

export interface SungNoteReadoutProps {
  detectedNote: NoteInfo | null;
  targetMidiNumber: number | null;
  micDisconnected: boolean;
}

function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)} ¢`;
}

/** The sung note and octave, big and in the tuning color, with its cents below — like the wheel's center. */
export function SungNoteReadout({ detectedNote, targetMidiNumber, micDisconnected }: SungNoteReadoutProps) {
  const status = statusForPitch(detectedNote, targetMidiNumber);
  return (
    <div className="sung-note-readout">
      {micDisconnected ? (
        <span data-testid="mic-disconnected-icon" className="sung-note" aria-hidden="true">
          🎤🚫
        </span>
      ) : (
        <span
          data-testid="sung-note"
          className="sung-note"
          style={status ? { color: STATUS_COLORS[status] } : undefined}
        >
          {detectedNote ? noteLabel(detectedNote.midiNumber) : ''}
        </span>
      )}
      <span data-testid="sung-note-cents" className="sung-note-cents">
        {detectedNote && !micDisconnected ? formatCents(detectedNote.cents) : ''}
      </span>
    </div>
  );
}
