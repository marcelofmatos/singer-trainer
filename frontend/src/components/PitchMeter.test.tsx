import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PitchMeter } from './PitchMeter';

describe('PitchMeter', () => {
  it('shows a placeholder when no note is detected', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} />);
    expect(screen.getByText('—')).toBeDefined();
  });

  it('shows the detected note name and octave', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByText('A4')).toBeDefined();
  });

  it('labels the needle as in tune when within 10 cents of the target', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByTestId('tuning-needle').dataset.status).toBe('in-tune');
  });

  it('labels the needle as off when far from the target', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 40 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByTestId('tuning-needle').dataset.status).toBe('off');
  });

  it('accounts for whole-semitone offsets from the target, not just cents', () => {
    // Two semitones flat of the target (midi 69) — the diff-in-semitones term must
    // dominate the gauge, not just the sub-semitone `cents` field.
    render(
      <PitchMeter
        detectedNote={{ noteName: 'G', octave: 4, midiNumber: 67, cents: 0 }}
        targetMidiNumber={69}
      />
    );
    const needle = screen.getByTestId('tuning-needle');
    expect(needle.dataset.status).toBe('off');
    // -200 cents clamps to the gauge's flat end (0%).
    expect(needle.style.left).toBe('0%');
  });

  it('falls back to nearest-chromatic-note tuning when no exercise target is active', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: -15 }}
        targetMidiNumber={null}
      />
    );
    expect(screen.getByTestId('tuning-needle').dataset.status).toBe('close');
  });
});
