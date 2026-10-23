// frontend/src/components/TunerView.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TunerView } from './TunerView';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 0, midiNumber, cents });

describe('TunerView', () => {
  it('shows the sung note with its octave', () => {
    render(<TunerView detectedNote={note(69, 0)} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.getByTestId('tuner-note').textContent).toBe('A4');
  });

  it('shows a dash without voice', () => {
    render(<TunerView detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.getByTestId('tuner-note').textContent).toBe('—');
    expect(screen.queryByTestId('tuner-needle')).toBeNull();
  });

  it('places the needle by cents from -50 to +50', () => {
    const { rerender } = render(<TunerView detectedNote={note(60, 0)} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.getByTestId('tuner-needle').getAttribute('data-percent')).toBe('50');
    rerender(<TunerView detectedNote={note(60, -25)} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.getByTestId('tuner-needle').getAttribute('data-percent')).toBe('25');
    expect(screen.getByTestId('tuner-cents').textContent).toBe('−25 ¢');
  });

  it('colors the needle by the octave-free status against the target', () => {
    render(<TunerView detectedNote={note(48, 3)} targetMidiNumber={60} micDisconnected={false} />);
    expect(screen.getByTestId('tuner-needle').getAttribute('data-status')).toBe('in-tune');
    expect(screen.getByText('Alvo: C4')).toBeDefined();
  });
});
