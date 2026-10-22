import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PitchMeter } from './PitchMeter';

const TRAIL_TICK_MS = 50;

describe('PitchMeter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all 12 chromatic note bubbles', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((name) => {
      expect(screen.getByTestId(`note-bubble-${name}`)).toBeDefined();
    });
  });

  it('shows no live indicator when no note is detected', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.queryByTestId('live-indicator')).toBeNull();
  });

  it('shows the live indicator once a note is detected', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.getByTestId('live-indicator')).toBeDefined();
  });

  it('marks the target note bubble as active and leaves others inactive', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    expect(screen.getByTestId('note-bubble-A').dataset.active).toBe('true');
    expect(screen.getByTestId('note-bubble-C').dataset.active).toBe('false');
  });

  it('labels the indicator as in tune when within 10 cents of the target', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('in-tune');
  });

  it('labels the indicator as off when far from the target', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 40 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('off');
  });

  it('accounts for whole-semitone offsets from the target, not just cents', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'G', octave: 4, midiNumber: 67, cents: 0 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('off');
  });

  it('falls back to nearest-chromatic-note tuning when no exercise target is active', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: -15 }}
        targetMidiNumber={null}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('close');
    expect(screen.getByTestId('note-bubble-A').dataset.active).toBe('false');
  });

  it('calls onNoteClick with the pitch class index when a bubble is clicked', () => {
    const handleClick = vi.fn();
    render(
      <PitchMeter
        detectedNote={null}
        targetMidiNumber={null}
        micDisconnected={false}
        onNoteClick={handleClick}
      />
    );
    fireEvent.click(screen.getByTestId('note-bubble-D'));
    expect(handleClick).toHaveBeenCalledWith(2);
  });

  it('calls onNoteClick when a bubble is activated via keyboard (Enter)', () => {
    const handleClick = vi.fn();
    render(
      <PitchMeter
        detectedNote={null}
        targetMidiNumber={null}
        micDisconnected={false}
        onNoteClick={handleClick}
      />
    );
    fireEvent.keyDown(screen.getByTestId('note-bubble-A'), { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledWith(9);
  });

  it('does not throw when a bubble is clicked without an onNoteClick handler', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    expect(() => fireEvent.click(screen.getByTestId('note-bubble-C'))).not.toThrow();
  });

  it('shows the sung note and octave in the center, colored by tuning status', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    const label = screen.getByTestId('center-note-label');
    expect(label.textContent).toBe('A4');
    expect(label.getAttribute('fill')).toBe('#2ecc71');
  });

  it('shows the mic-disconnected icon instead of the note label when the mic is disconnected', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={true}
      />
    );
    expect(screen.getByTestId('mic-disconnected-icon').textContent).toBe('🎤🚫');
    expect(screen.queryByTestId('center-note-label')).toBeNull();
  });

  it('shows nothing in the center when there is no detected note and the mic is connected', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.queryByTestId('center-note-label')).toBeNull();
    expect(screen.queryByTestId('mic-disconnected-icon')).toBeNull();
  });

  it('grows a fading trail behind the live indicator as ticks pass', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS * 3);
    });
    expect(screen.getAllByTestId('live-indicator-trail').length).toBe(2);
    expect(screen.getByTestId('live-indicator')).toBeDefined();
  });

  it('caps the trail at 6 points even after many ticks', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS * 10);
    });
    expect(screen.getAllByTestId('live-indicator-trail').length).toBe(5);
  });

  it('fades the trail out one point per tick after the note stops, instead of vanishing instantly', () => {
    const { rerender } = render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS * 6);
    });
    expect(screen.getAllByTestId('live-indicator-trail').length).toBe(5);

    rerender(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.getAllByTestId('live-indicator-trail').length).toBe(4);
    expect(screen.getByTestId('live-indicator')).toBeDefined();
  });

  it('fully empties the trail after enough silent ticks', () => {
    const { rerender } = render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS * 6);
    });

    rerender(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS * 6);
    });
    expect(screen.queryByTestId('live-indicator')).toBeNull();
    expect(screen.queryAllByTestId('live-indicator-trail').length).toBe(0);
  });

  it('exposes a single tab stop on the wheel, starting at C', () => {
    render(
      <PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} onNoteClick={() => {}} />
    );
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const tabIndexes = names.map((name) => screen.getByTestId(`note-bubble-${name}`).getAttribute('tabindex'));
    expect(tabIndexes.filter((value) => value === '0')).toHaveLength(1);
    expect(screen.getByTestId('note-bubble-C').getAttribute('tabindex')).toBe('0');
  });

  it('moves focus around the wheel with the arrow keys, wrapping B<->C', () => {
    render(
      <PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} onNoteClick={() => {}} />
    );
    const c = screen.getByTestId('note-bubble-C');
    act(() => c.focus());

    fireEvent.keyDown(c, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-C#'));

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-B'));

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(c);
    expect(screen.getByTestId('note-bubble-B').getAttribute('tabindex')).toBe('-1');
  });

  it('jumps back to C with Home', () => {
    render(
      <PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} onNoteClick={() => {}} />
    );
    const g = screen.getByTestId('note-bubble-G');
    act(() => g.focus());
    fireEvent.keyDown(g, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-C'));
  });
});
