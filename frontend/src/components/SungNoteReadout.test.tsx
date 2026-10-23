import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SungNoteReadout } from './SungNoteReadout';
import { STATUS_COLORS } from '../lib/tuningGauge';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 0, midiNumber, cents });

function hexToRgb(hex: string): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgb(${value >> 16}, ${(value >> 8) & 255}, ${value & 255})`;
}

describe('SungNoteReadout', () => {
  it('shows the sung note and octave in the tuning color, with the cents below', () => {
    render(<SungNoteReadout detectedNote={note(70, 12)} targetMidiNumber={70} micDisconnected={false} />);
    const label = screen.getByTestId('sung-note');
    expect(label.textContent).toBe('A#4');
    expect(label.style.color).toBe(hexToRgb(STATUS_COLORS.close));
    expect(screen.getByTestId('sung-note-cents').textContent).toBe('+12 ¢');
  });

  it('colors the note against the target in any octave', () => {
    render(<SungNoteReadout detectedNote={note(57, 3)} targetMidiNumber={69} micDisconnected={false} />);
    expect(screen.getByTestId('sung-note').textContent).toBe('A3');
    expect(screen.getByTestId('sung-note').style.color).toBe(hexToRgb(STATUS_COLORS['in-tune']));
  });

  it('formats flat cents with a minus sign', () => {
    render(<SungNoteReadout detectedNote={note(60, -7.6)} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.getByTestId('sung-note-cents').textContent).toBe('−8 ¢');
  });

  it('stays empty, keeping its place, in silence', () => {
    render(<SungNoteReadout detectedNote={null} targetMidiNumber={60} micDisconnected={false} />);
    expect(screen.getByTestId('sung-note').textContent).toBe('');
    expect(screen.getByTestId('sung-note-cents').textContent).toBe('');
  });

  it('shows the mic icon instead of the note when the mic fails', () => {
    render(<SungNoteReadout detectedNote={note(70, 12)} targetMidiNumber={null} micDisconnected />);
    expect(screen.getByTestId('mic-disconnected-icon').textContent).toBe('🎤🚫');
    expect(screen.queryByTestId('sung-note')).toBeNull();
    expect(screen.getByTestId('sung-note-cents').textContent).toBe('');
  });
});
