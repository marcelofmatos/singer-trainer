import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PianoRollView } from './PianoRollView';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 0, midiNumber, cents });

describe('PianoRollView', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('draws the target as bars and the voice as a line over time', () => {
    const { rerender } = render(<PianoRollView detectedNote={note(60, 0)} targetMidiNumber={60} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender(<PianoRollView detectedNote={note(60, 5)} targetMidiNumber={60} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getAllByTestId('roll-target').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('roll-voice').length).toBeGreaterThan(0);
  });

  it('breaks the voice line during silence', () => {
    const { rerender } = render(<PianoRollView detectedNote={note(60, 0)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender(<PianoRollView detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender(<PianoRollView detectedNote={note(62, 0)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getAllByTestId('roll-voice')).toHaveLength(2);
  });

  it('labels the C rows', () => {
    render(<PianoRollView detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.getByText('C4')).toBeDefined();
  });
});
