import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PianoRollView } from './PianoRollView';
import { CHROMATIC_NOTE_COLORS } from '../lib/chromaticWheel';

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

  it('tints each row with the note color from the wheel', () => {
    const { container } = render(<PianoRollView detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    const row = (midi: number) => container.querySelector(`[data-testid="roll-row-${midi}"]`)!;
    expect(row(60).getAttribute('fill')).toBe(CHROMATIC_NOTE_COLORS[0]);
    expect(row(61).getAttribute('fill')).toBe(CHROMATIC_NOTE_COLORS[1]);
    expect(row(69).getAttribute('fill')).toBe(CHROMATIC_NOTE_COLORS[9]);
    expect(Number(row(60).getAttribute('fill-opacity'))).toBeLessThanOrEqual(0.2);
  });

  it('labels every semitone row when there is room', () => {
    render(<PianoRollView detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5'].forEach((label) => {
      expect(screen.getByText(label)).toBeDefined();
    });
  });

  function renderRange(lowMidi: number, highMidi: number) {
    const { container, rerender } = render(
      <PianoRollView detectedNote={note(lowMidi, 0)} targetMidiNumber={null} micDisconnected={false} />
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(<PianoRollView detectedNote={note(highMidi, 0)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    return container;
  }

  function labelPositions(container: HTMLElement) {
    return [...container.querySelectorAll('svg.piano-roll text')].map((label) => ({
      text: label.textContent,
      y: Number(label.getAttribute('y')),
      size: Number(label.getAttribute('font-size')),
    }));
  }

  it('keeps a readable font and skips labels that would overlap when rows are tight', () => {
    const container = renderRange(48, 70);
    const labels = labelPositions(container);
    expect(labels.every((label) => label.size === 11)).toBe(true);
    const ys = labels.map((label) => label.y).sort((a, b) => a - b);
    ys.slice(1).forEach((y, index) => expect(y - ys[index]).toBeGreaterThanOrEqual(11));
    expect(screen.getByText('C4')).toBeDefined();
    expect(screen.queryByText('C#4')).toBeNull();
  });

  it('always labels the Cs, even when rows are very tight', () => {
    const container = renderRange(36, 84);
    ['C3', 'C4', 'C5'].forEach((label) => expect(screen.getByText(label)).toBeDefined());
    expect(screen.queryByText('D4')).toBeNull();
    expect(labelPositions(container).every((label) => label.size === 11)).toBe(true);
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
