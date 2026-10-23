// frontend/src/components/KeyboardView.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { act, createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { KeyboardView } from './KeyboardView';
import type { NoteNavigatorHandle } from './PitchMeter';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 0, midiNumber, cents });

function renderKeyboard(overrides: Partial<Parameters<typeof KeyboardView>[0]> = {}) {
  const onPlayNote = vi.fn();
  const ref = createRef<NoteNavigatorHandle>();
  render(
    <KeyboardView
      ref={ref}
      lowMidi={60}
      detectedNote={null}
      targetMidiNumber={null}
      micDisconnected={false}
      onPlayNote={onPlayNote}
      {...overrides}
    />
  );
  return { onPlayNote, ref };
}

describe('KeyboardView', () => {
  it('renders two octaves of keys starting at the given C', () => {
    renderKeyboard();
    const keys = screen.getAllByRole('button');
    expect(keys).toHaveLength(24);
    const labels = keys.map((key) => key.getAttribute('aria-label'));
    expect(new Set(labels).size).toBe(24);
    expect(labels).toContain('C4');
    expect(labels).toContain('B5');
    expect(labels).not.toContain('B3');
    expect(labels).not.toContain('C6');
  });

  it('outlines the target key and lights the sung key with its status and cents', () => {
    renderKeyboard({ targetMidiNumber: 62, detectedNote: note(62, 12) });
    expect(screen.getByRole('button', { name: 'D4' }).getAttribute('data-target')).toBe('true');
    expect(screen.getByRole('button', { name: 'D4' }).getAttribute('data-status')).toBe('close');
    expect(screen.getByTestId('keyboard-cents').textContent).toBe('+12 ¢');
  });

  it('points to a sung note outside the keyboard instead of lighting a key', () => {
    renderKeyboard({ detectedNote: note(43, 0) });
    expect(screen.getByTestId('keyboard-out-of-range').textContent).toBe('◀ G2');
    expect(screen.getAllByRole('button').some((key) => key.hasAttribute('data-status'))).toBe(false);
  });

  it('plays the clicked key in its own octave', () => {
    const { onPlayNote } = renderKeyboard();
    fireEvent.click(screen.getByRole('button', { name: 'A5' }));
    expect(onPlayNote).toHaveBeenCalledWith(81);
  });

  it('is navigable through the same handle as the wheel', () => {
    const { ref, onPlayNote } = renderKeyboard();
    act(() => ref.current!.navigate('next'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'C4' }));
    act(() => ref.current!.navigate('next'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'C#4' }));
    act(() => ref.current!.navigate('previous'));
    act(() => ref.current!.navigate('previous'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'B5' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(onPlayNote).toHaveBeenCalledWith(83);
    act(() => ref.current!.navigate('first'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'C4' }));
  });
});
