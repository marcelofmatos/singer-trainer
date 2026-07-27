// frontend/src/components/PitchMeter.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PitchMeter } from './PitchMeter';

describe('PitchMeter', () => {
  it('renders all 12 chromatic note bubbles', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} />);
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((name) => {
      expect(screen.getByTestId(`note-bubble-${name}`)).toBeDefined();
    });
  });

  it('shows no live indicator when no note is detected', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} />);
    expect(screen.queryByTestId('live-indicator')).toBeNull();
  });

  it('shows the live indicator once a note is detected', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByTestId('live-indicator')).toBeDefined();
  });

  it('marks the target note bubble as active and leaves others inactive', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
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
      />
    );
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('in-tune');
  });

  it('labels the indicator as off when far from the target', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 40 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('off');
  });

  it('accounts for whole-semitone offsets from the target, not just cents', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'G', octave: 4, midiNumber: 67, cents: 0 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('off');
  });

  it('falls back to nearest-chromatic-note tuning when no exercise target is active', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: -15 }}
        targetMidiNumber={null}
      />
    );
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('close');
    expect(screen.getByTestId('note-bubble-A').dataset.active).toBe('false');
  });

  it('calls onNoteClick with the pitch class index when a bubble is clicked', () => {
    const handleClick = vi.fn();
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} onNoteClick={handleClick} />);
    fireEvent.click(screen.getByTestId('note-bubble-D'));
    expect(handleClick).toHaveBeenCalledWith(2);
  });

  it('calls onNoteClick when a bubble is activated via keyboard (Enter)', () => {
    const handleClick = vi.fn();
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} onNoteClick={handleClick} />);
    fireEvent.keyDown(screen.getByTestId('note-bubble-A'), { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledWith(9);
  });

  it('does not throw when a bubble is clicked without an onNoteClick handler', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} />);
    expect(() => fireEvent.click(screen.getByTestId('note-bubble-C'))).not.toThrow();
  });
});
