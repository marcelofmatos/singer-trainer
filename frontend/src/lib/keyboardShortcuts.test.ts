// frontend/src/lib/keyboardShortcuts.test.ts
import { describe, expect, it } from 'vitest';
import { resolveShortcut, SHORTCUT_HELP, stepWithin, type ShortcutKeyEvent } from './keyboardShortcuts';

function keyEvent(key: string, overrides: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent {
  return { key, ctrlKey: false, altKey: false, metaKey: false, target: document.body, ...overrides };
}

function input(type: string): HTMLInputElement {
  const element = document.createElement('input');
  element.type = type;
  return element;
}

describe('resolveShortcut', () => {
  it.each([
    [' ', 'togglePlay'],
    ['s', 'toggleMute'],
    ['m', 'toggleMic'],
    ['r', 'toggleLoop'],
    ['ArrowLeft', 'slower'],
    ['ArrowRight', 'faster'],
    ['ArrowDown', 'lessSensitive'],
    ['ArrowUp', 'moreSensitive'],
    ['PageUp', 'previousExercise'],
    ['[', 'previousExercise'],
    ['PageDown', 'nextExercise'],
    [']', 'nextExercise'],
    ['?', 'showHelp'],
  ])('maps %j to %s', (key, action) => {
    expect(resolveShortcut(keyEvent(key))).toBe(action);
  });

  it('accepts uppercase letters (Caps Lock or Shift)', () => {
    expect(resolveShortcut(keyEvent('S'))).toBe('toggleMute');
    expect(resolveShortcut(keyEvent('M'))).toBe('toggleMic');
  });

  it('returns null for unmapped keys', () => {
    expect(resolveShortcut(keyEvent('x'))).toBeNull();
    expect(resolveShortcut(keyEvent('Enter'))).toBeNull();
  });

  it.each(['ctrlKey', 'altKey', 'metaKey'] as const)('ignores shortcuts while %s is held', (modifier) => {
    expect(resolveShortcut(keyEvent('s', { [modifier]: true }))).toBeNull();
  });

  it('ignores every key while a select, textarea or text input is focused', () => {
    for (const target of [document.createElement('select'), document.createElement('textarea'), input('text')]) {
      expect(resolveShortcut(keyEvent('s', { target }))).toBeNull();
      expect(resolveShortcut(keyEvent(' ', { target }))).toBeNull();
    }
  });

  it('lets a focused button keep Space and arrows but still honors letter shortcuts', () => {
    const button = document.createElement('button');
    expect(resolveShortcut(keyEvent(' ', { target: button }))).toBeNull();
    expect(resolveShortcut(keyEvent('ArrowRight', { target: button }))).toBeNull();
    expect(resolveShortcut(keyEvent('s', { target: button }))).toBe('toggleMute');
  });

  it('treats role="button" elements and checkboxes like buttons', () => {
    const bubble = document.createElement('div');
    bubble.setAttribute('role', 'button');
    expect(resolveShortcut(keyEvent('ArrowLeft', { target: bubble }))).toBeNull();
    expect(resolveShortcut(keyEvent('m', { target: bubble }))).toBe('toggleMic');
    expect(resolveShortcut(keyEvent(' ', { target: input('checkbox') }))).toBeNull();
    expect(resolveShortcut(keyEvent('r', { target: input('checkbox') }))).toBe('toggleLoop');
  });

  it('lets a focused range slider keep arrows and PageUp/PageDown', () => {
    const slider = input('range');
    expect(resolveShortcut(keyEvent('ArrowUp', { target: slider }))).toBeNull();
    expect(resolveShortcut(keyEvent('PageDown', { target: slider }))).toBeNull();
    expect(resolveShortcut(keyEvent(']', { target: slider }))).toBe('nextExercise');
    expect(resolveShortcut(keyEvent(' ', { target: slider }))).toBe('togglePlay');
  });
});

describe('stepWithin', () => {
  it('steps and clamps to the range', () => {
    expect(stepWithin(1, 0.25, 0.5, 2)).toBe(1.25);
    expect(stepWithin(2, 0.25, 0.5, 2)).toBe(2);
    expect(stepWithin(0.5, -0.25, 0.5, 2)).toBe(0.5);
  });

  it('rounds away floating point drift', () => {
    expect(stepWithin(0.15, 0.05, 0.05, 0.35)).toBe(0.2);
    expect(stepWithin(0.1, 0.05, 0.05, 0.35)).toBe(0.15);
  });
});

describe('SHORTCUT_HELP', () => {
  it('lists every shortcut with a description', () => {
    expect(SHORTCUT_HELP.length).toBeGreaterThanOrEqual(9);
    SHORTCUT_HELP.forEach(({ keys, description }) => {
      expect(keys).not.toBe('');
      expect(description).not.toBe('');
    });
  });
});
