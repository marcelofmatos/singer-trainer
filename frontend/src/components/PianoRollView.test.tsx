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
    const pieces = screen.getAllByTestId('roll-voice');
    expect(pieces).toHaveLength(2);
    const xs = (element: Element) => (element.getAttribute('points') ?? '').split(' ').map((pair) => Number(pair.split(',')[0]));
    expect(Math.max(...xs(pieces[0]))).toBeLessThan(Math.min(...xs(pieces[1])));
  });

  it('keeps the color of past stretches when the status changes', () => {
    const { rerender } = render(<PianoRollView detectedNote={note(60, 0)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender(<PianoRollView detectedNote={note(60, 15)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const pieces = screen.getAllByTestId('roll-voice');
    expect(pieces[0].getAttribute('data-status')).toBe('in-tune');
    expect(pieces[pieces.length - 1].getAttribute('data-status')).toBe('close');
  });

  it('keys voice runs uniquely when the status flips right after silence', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { rerender } = render(<PianoRollView detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      rerender(<PianoRollView detectedNote={note(60, 0)} targetMidiNumber={null} micDisconnected={false} />);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      rerender(<PianoRollView detectedNote={note(60, 40)} targetMidiNumber={null} micDisconnected={false} />);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      const duplicateKeyWarnings = consoleError.mock.calls.filter((call) => String(call[0]).includes('same key'));
      expect(duplicateKeyWarnings).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('does not draw voice points outside the computed range', () => {
    const { rerender } = render(<PianoRollView detectedNote={note(60, 0)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender(<PianoRollView detectedNote={note(100, 0)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const ys = screen
      .getAllByTestId('roll-voice')
      .flatMap((element) => (element.getAttribute('points') ?? `0,${element.getAttribute('cy')}`).split(' '))
      .map((pair) => Number(pair.split(',')[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
  });

  it('labels every semitone row when there is room', () => {
    render(<PianoRollView detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5'].forEach((label) => {
      expect(screen.getByText(label)).toBeDefined();
    });
  });

  it('labels only the natural notes when the range is too tall for every row', () => {
    const { rerender } = render(<PianoRollView detectedNote={note(40, 0)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(<PianoRollView detectedNote={note(76, 0)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText('D4')).toBeDefined();
    expect(screen.queryByText('C#4')).toBeNull();
  });

  it('shows the sung note above the roll, and the mic icon when the mic fails', () => {
    const { rerender } = render(<PianoRollView detectedNote={note(69, 4)} targetMidiNumber={69} micDisconnected={false} />);
    expect(screen.getByTestId('sung-note').textContent).toBe('A4');
    expect(screen.getByTestId('sung-note-cents').textContent).toBe('+4 ¢');
    expect(screen.getByTestId('sung-note').compareDocumentPosition(screen.getByRole('img', { name: 'Piano-roll' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    rerender(<PianoRollView detectedNote={note(69, 4)} targetMidiNumber={69} micDisconnected />);
    expect(screen.getByTestId('mic-disconnected-icon').textContent).toBe('🎤🚫');
    expect(screen.queryByTestId('sung-note')).toBeNull();
  });
});
