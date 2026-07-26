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
});
