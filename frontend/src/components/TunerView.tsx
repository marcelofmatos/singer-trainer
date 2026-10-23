// frontend/src/components/TunerView.tsx
import { CHROMATIC_NOTE_NAMES, pitchClassIndex } from '../lib/chromaticWheel';
import { centsToGaugePercent, STATUS_COLORS, statusForPitch } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';

export interface TunerViewProps {
  detectedNote: NoteInfo | null;
  targetMidiNumber: number | null;
  micDisconnected: boolean;
}

export function noteLabel(midiNumber: number): string {
  return `${CHROMATIC_NOTE_NAMES[pitchClassIndex(midiNumber)]}${Math.floor(midiNumber / 12) - 1}`;
}

function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)} ¢`;
}

/** Classic chromatic tuner: big note name and a ±50 cents needle. */
export function TunerView({ detectedNote, targetMidiNumber, micDisconnected }: TunerViewProps) {
  const status = statusForPitch(detectedNote, targetMidiNumber);
  const percent = detectedNote ? Math.round(centsToGaugePercent(detectedNote.cents)) : null;

  return (
    <div className={micDisconnected ? 'tuner-view is-disconnected' : 'tuner-view'} role="img" aria-label="Afinador cromático">
      <div className="tuner-note" data-testid="tuner-note">
        {detectedNote ? noteLabel(detectedNote.midiNumber) : '—'}
      </div>
      <div className="tuner-scale">
        <span className="tuner-scale-center" />
        {percent !== null && status && (
          <span
            className="tuner-needle"
            data-testid="tuner-needle"
            data-percent={percent}
            data-status={status}
            style={{ left: `${percent}%`, background: STATUS_COLORS[status] }}
          />
        )}
      </div>
      <div className="tuner-legend">
        <span>♭ −50</span>
        <span data-testid="tuner-cents">{detectedNote ? formatCents(detectedNote.cents) : ''}</span>
        <span>+50 ♯</span>
      </div>
      {targetMidiNumber !== null && <div className="tuner-target">Alvo: {noteLabel(targetMidiNumber)}</div>}
    </div>
  );
}
