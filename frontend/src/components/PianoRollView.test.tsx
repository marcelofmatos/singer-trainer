import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PianoRollView } from './PianoRollView';
import { CHROMATIC_NOTE_COLORS, readableTextColor } from '../lib/chromaticWheel';
import { STATUS_COLORS } from '../lib/tuningGauge';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 0, midiNumber, cents });

describe('PianoRollView', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('draws the target as bars and the voice as blocks over time', () => {
    const { rerender } = render(<PianoRollView detectedNote={note(60, 0)} targetMidiNumber={60} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender(<PianoRollView detectedNote={note(60, 5)} targetMidiNumber={60} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getAllByTestId('roll-target').length).toBeGreaterThan(0);
    const voice = screen.getAllByTestId('roll-voice');
    expect(voice.length).toBeGreaterThan(0);
    expect(voice.every((block) => block.tagName === 'rect')).toBe(true);
  });

  it('breaks the voice blocks during silence', () => {
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
    const end = Number(pieces[0].getAttribute('x')) + Number(pieces[0].getAttribute('width'));
    expect(end).toBeLessThan(Number(pieces[1].getAttribute('x')));
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
    const blocks = screen.getAllByTestId('roll-voice');
    expect(Math.min(...blocks.map((block) => Number(block.getAttribute('y'))))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...blocks.map((block) => Number(block.getAttribute('y')) + Number(block.getAttribute('height'))))).toBeLessThanOrEqual(260);
  });

  it('draws nothing for the voice in silence', () => {
    render(<PianoRollView detectedNote={null} targetMidiNumber={60} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryAllByTestId('roll-voice')).toEqual([]);
  });

  it('colours each block by its tuning status', () => {
    const { rerender } = render(<PianoRollView detectedNote={note(60, 0)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(<PianoRollView detectedNote={note(60, 40)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const blocks = screen.getAllByTestId('roll-voice');
    expect(blocks.map((block) => block.getAttribute('data-status'))).toEqual(['in-tune', 'off']);
    expect(blocks.map((block) => block.getAttribute('fill'))).toEqual([STATUS_COLORS['in-tune'], STATUS_COLORS.off]);
  });

  it('fills the note row at fill 1 and draws a thin strip at fill 0', () => {
    const heights = (fill: number) => {
      const { unmount } = render(
        <PianoRollView detectedNote={note(60, 20)} targetMidiNumber={null} micDisconnected={false} fill={fill} />
      );
      act(() => {
        vi.advanceTimersByTime(100);
      });
      const rowHeight = Number(screen.getByTestId('roll-row-60').getAttribute('height'));
      const result = screen.getAllByTestId('roll-voice').map((block) => Number(block.getAttribute('height')));
      unmount();
      return { rowHeight, result };
    };
    const full = heights(1);
    expect(full.result.every((height) => Math.abs(height - full.rowHeight) < 1e-9)).toBe(true);
    const thin = heights(0);
    expect(thin.result.every((height) => Math.abs(height - 2.5) < 1e-9)).toBe(true);
  });

  it('colors the legend cell of each row with the note color from the wheel, not the chart', () => {
    const { container } = render(<PianoRollView detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    const legend = (midi: number) => container.querySelector(`[data-testid="roll-legend-${midi}"]`)!;
    expect(legend(60).getAttribute('fill')).toBe(CHROMATIC_NOTE_COLORS[0]);
    expect(legend(61).getAttribute('fill')).toBe(CHROMATIC_NOTE_COLORS[1]);
    expect(legend(69).getAttribute('fill')).toBe(CHROMATIC_NOTE_COLORS[9]);
    expect(Number(legend(60).getAttribute('x'))).toBe(0);
    const chartRow = container.querySelector('[data-testid="roll-row-60"]')!;
    expect(chartRow.getAttribute('fill')).not.toBe(CHROMATIC_NOTE_COLORS[0]);
  });

  it('writes each legend label in a color readable on its note color', () => {
    render(<PianoRollView detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.getByText('C4').getAttribute('fill')).toBe(readableTextColor(CHROMATIC_NOTE_COLORS[0]));
    expect(screen.getByText('G#4').getAttribute('fill')).toBe(readableTextColor(CHROMATIC_NOTE_COLORS[8]));
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

  // The target moves from C4 to D4 at 1 s; the voice sings the same line 200 ms late in real time.
  function renderLateVoice(latencyMs: number) {
    const roll = (detected: number | null, target: number) => (
      <PianoRollView
        detectedNote={detected === null ? null : note(detected, 0)}
        targetMidiNumber={target}
        micDisconnected={false}
        latencyMs={latencyMs}
      />
    );
    const { rerender } = render(roll(null, 60));
    const step = (ms: number) =>
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    step(200);
    rerender(roll(60, 60));
    step(800);
    rerender(roll(60, 62));
    step(200);
    rerender(roll(62, 62));
    step(800);
    const right = (element: Element) => Number(element.getAttribute('x')) + Number(element.getAttribute('width'));
    const rowOf = (element: Element) => Number(element.getAttribute('y')) + Number(element.getAttribute('height')) / 2;
    const c4Row = rowOf(screen.getByTestId('roll-row-60'));
    const c4Bar = screen.getAllByTestId('roll-target').find((bar) => Math.abs(rowOf(bar) - c4Row) < 1e-6)!;
    const c4Blocks = screen.getAllByTestId('roll-voice').filter((block) => Math.abs(rowOf(block) - c4Row) < 1e-6);
    const tick = (360 - 34) * (50 / 6000);
    return { c4Bar, c4Blocks, right, tick };
  }

  it('draws a late input at its corrected time, aligned with the target and coloured against it', () => {
    const { c4Bar, c4Blocks, right, tick } = renderLateVoice(200);
    const statuses = screen.getAllByTestId('roll-voice').map((block) => block.getAttribute('data-status'));
    expect(statuses.every((status) => status === 'in-tune')).toBe(true);
    expect(Math.abs(right(c4Blocks[c4Blocks.length - 1]) - right(c4Bar))).toBeLessThanOrEqual(tick + 1e-6);
    expect(Math.abs(Number(c4Blocks[0].getAttribute('x')) - Number(c4Bar.getAttribute('x')))).toBeLessThanOrEqual(tick + 1e-6);
  });

  it('without the latency, the same late input runs past the target and is marked off there', () => {
    const { c4Bar, c4Blocks, right, tick } = renderLateVoice(0);
    expect(right(c4Blocks[c4Blocks.length - 1]) - right(c4Bar)).toBeGreaterThan(3 * tick);
    expect(screen.getAllByTestId('roll-voice').some((block) => block.getAttribute('data-status') === 'off')).toBe(true);
  });

  it('draws the target at its own corrected time', () => {
    const roll = (target: number) => (
      <PianoRollView detectedNote={null} targetMidiNumber={target} micDisconnected={false} targetLatencyMs={300} />
    );
    const { rerender } = render(roll(60));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender(roll(62));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const bars = screen.getAllByTestId('roll-target');
    const last = bars[bars.length - 1];
    const rightEdge = Number(last.getAttribute('x')) + Number(last.getAttribute('width'));
    // The newest target reading is 300 ms old: it ends 300 ms (5% of the 6 s window) before the right edge.
    expect(rightEdge).toBeCloseTo(360 - (360 - 34) * (300 / 6000), 0);
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
