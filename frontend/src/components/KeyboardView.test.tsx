// frontend/src/components/KeyboardView.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { act, createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { KeyboardView } from './KeyboardView';
import type { NoteNavigatorHandle } from './PitchMeter';
import { keyboardOffsetPercent } from '../lib/keyboardWindow';
import { STATUS_COLORS } from '../lib/tuningGauge';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 0, midiNumber, cents });

type Props = Parameters<typeof KeyboardView>[0];

function props(overrides: Partial<Props> = {}): Props {
  return {
    detectedNote: null,
    targetMidiNumber: null,
    micDisconnected: false,
    onPlayNote: vi.fn(),
    ...overrides,
  };
}

function renderKeyboard(overrides: Partial<Props> = {}) {
  const ref = createRef<NoteNavigatorHandle>();
  const all = props(overrides);
  const utils = render(<KeyboardView ref={ref} {...all} />);
  // Each rerender starts from the defaults, so it states the whole input it means.
  const rerender = (next: Partial<Props>) =>
    utils.rerender(<KeyboardView ref={ref} {...props({ onPlayNote: all.onPlayNote, ...next })} />);
  return { onPlayNote: all.onPlayNote, ref, rerender };
}

const offset = () => screen.getByTestId('keyboard-keys').getAttribute('data-offset');
const expected = (midi: number) => String(Math.round(keyboardOffsetPercent(midi) * 100) / 100);

describe('KeyboardView', () => {
  it('renders the whole vocal range, 49 keys from C2 to C6', () => {
    renderKeyboard();
    const keys = screen.getAllByRole('button');
    expect(keys).toHaveLength(49);
    const labels = keys.map((key) => key.getAttribute('aria-label'));
    expect(new Set(labels).size).toBe(49);
    expect(labels).toContain('C2');
    expect(labels).toContain('C6');
    expect(labels).not.toContain('B1');
    expect(labels).not.toContain('C#6');
  });

  it('slides the keys with a translateX of the offset', () => {
    renderKeyboard({ targetMidiNumber: 62 });
    const keys = screen.getByTestId('keyboard-keys');
    expect(keys.style.transform).toBe(`translateX(${keyboardOffsetPercent(62)}%)`);
  });

  it('centers the target note, else the sung note, and starts on C4', () => {
    const { rerender } = renderKeyboard();
    expect(offset()).toBe(expected(60));
    rerender({ detectedNote: note(70, 0) });
    expect(offset()).toBe(expected(70));
    rerender({ detectedNote: note(70, 0), targetMidiNumber: 64 });
    expect(offset()).toBe(expected(64));
    expect(expected(64)).not.toBe(expected(70));
  });

  it('keeps the last focus note during silence', () => {
    const { rerender } = renderKeyboard({ detectedNote: note(70, 0) });
    expect(offset()).toBe(expected(70));
    rerender({ detectedNote: null });
    expect(offset()).toBe(expected(70));
    rerender({ targetMidiNumber: 50 });
    rerender({ targetMidiNumber: null });
    expect(offset()).toBe(expected(50));
  });

  it('stops at both ends of the keyboard', () => {
    const { rerender } = renderKeyboard({ targetMidiNumber: 36 });
    expect(offset()).toBe('0');
    rerender({ targetMidiNumber: 84 });
    expect(offset()).toBe(String(Math.round((-15 / 29) * 10000) / 100));
  });

  it('shows the sung note and octave in the center, in the tuning color, with the cents below', () => {
    renderKeyboard({ targetMidiNumber: 70, detectedNote: note(70, 12) });
    const label = screen.getByTestId('sung-note');
    expect(label.textContent).toBe('A#4');
    expect(label.style.color).toBe(hexToRgb(STATUS_COLORS.close));
    expect(screen.getByTestId('sung-note-cents').textContent).toBe('+12 ¢');
  });

  it('leaves the center empty in silence and shows the mic icon when the mic fails', () => {
    const { rerender } = renderKeyboard();
    expect(screen.getByTestId('sung-note').textContent).toBe('');
    expect(screen.getByTestId('sung-note-cents').textContent).toBe('');
    rerender({ micDisconnected: true, detectedNote: note(70, 12) });
    expect(screen.getByTestId('mic-disconnected-icon').textContent).toBe('🎤🚫');
    expect(screen.queryByTestId('sung-note')).toBeNull();
  });

  it('outlines the target key and lights the sung key with its status', () => {
    renderKeyboard({ targetMidiNumber: 62, detectedNote: note(62, 12) });
    expect(screen.getByRole('button', { name: 'D4' }).getAttribute('data-target')).toBe('true');
    expect(screen.getByRole('button', { name: 'D4' }).getAttribute('data-status')).toBe('close');
  });

  it('points to a sung note outside C2–C6 instead of lighting a key', () => {
    const { rerender } = renderKeyboard({ detectedNote: note(31, 0) });
    expect(screen.getByTestId('keyboard-out-of-range').textContent).toBe('◀ G1');
    expect(screen.getAllByRole('button').some((key) => key.hasAttribute('data-status'))).toBe(false);
    rerender({ detectedNote: note(86, 0) });
    expect(screen.getByTestId('keyboard-out-of-range').textContent).toBe('D6 ▶');
    rerender({ detectedNote: note(84, 0) });
    expect(screen.queryByTestId('keyboard-out-of-range')).toBeNull();
  });

  it('plays the clicked key in its own octave', () => {
    const { onPlayNote } = renderKeyboard();
    fireEvent.click(screen.getByRole('button', { name: 'A2' }));
    expect(onPlayNote).toHaveBeenCalledWith(45);
  });

  it('walks the 49 keys through the navigation handle, the window following the focused key', () => {
    const { ref, onPlayNote } = renderKeyboard({ targetMidiNumber: 72 });
    act(() => ref.current!.navigate('next'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'C4' }));
    expect(offset()).toBe(expected(60));
    act(() => ref.current!.navigate('next'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'C#4' }));
    expect(offset()).toBe(expected(61));
    for (let step = 0; step < 25; step += 1) act(() => ref.current!.navigate('previous'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'C2' }));
    expect(offset()).toBe('0');
    act(() => ref.current!.navigate('previous'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'C6' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(onPlayNote).toHaveBeenCalledWith(84);
    act(() => ref.current!.navigate('first'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'C4' }));
    act(() => (document.activeElement as HTMLElement).blur());
    expect(offset()).toBe(expected(72));
  });

  it('draws the target outline above every key, without catching clicks', () => {
    renderKeyboard({ targetMidiNumber: 64 });
    const outline = screen.getByTestId('keyboard-target-outline');
    const svg = outline.closest('svg')!;
    expect(svg.lastElementChild).toBe(outline);
    expect(outline.getAttribute('pointer-events')).toBe('none');
    expect(outline.getAttribute('fill')).toBe('none');
    expect(outline.getAttribute('stroke-width')).toBe('3');
  });

  it('draws no target outline without a target or with the target off the keyboard', () => {
    const { rerender } = renderKeyboard({ targetMidiNumber: 30 });
    expect(screen.queryByTestId('keyboard-target-outline')).toBeNull();
    rerender({ targetMidiNumber: null });
    expect(screen.queryByTestId('keyboard-target-outline')).toBeNull();
  });
});

function hexToRgb(hex: string): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgb(${value >> 16}, ${(value >> 8) & 255}, ${value & 255})`;
}
