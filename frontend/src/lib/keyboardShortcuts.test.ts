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
    ['v', 'nextView'],
    ['ArrowRight', 'nextNote'],
    ['ArrowDown', 'nextNote'],
    ['ArrowLeft', 'previousNote'],
    ['ArrowUp', 'previousNote'],
    ['Home', 'firstNote'],
    ['-', 'slower'],
    ['+', 'faster'],
    ['=', 'faster'],
    [',', 'lessSensitive'],
    ['.', 'moreSensitive'],
    ['PageUp', 'previousExercise'],
    ['[', 'previousExercise'],
    ['PageDown', 'nextExercise'],
    [']', 'nextExercise'],
    ['?', 'showHelp'],
    ['h', 'showHistory'],
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

  it('lets a focused button or checkbox keep only Space', () => {
    for (const target of [document.createElement('button'), input('checkbox')]) {
      expect(resolveShortcut(keyEvent(' ', { target }))).toBeNull();
      expect(resolveShortcut(keyEvent('ArrowRight', { target }))).toBe('nextNote');
      expect(resolveShortcut(keyEvent('s', { target }))).toBe('toggleMute');
    }
  });

  it('sends Space, arrows and Home from a focused wheel bubble to the global shortcuts', () => {
    const bubble = document.createElement('div');
    bubble.setAttribute('role', 'button');
    expect(resolveShortcut(keyEvent(' ', { target: bubble }))).toBe('togglePlay');
    expect(resolveShortcut(keyEvent('ArrowLeft', { target: bubble }))).toBe('previousNote');
    expect(resolveShortcut(keyEvent('Home', { target: bubble }))).toBe('firstNote');
  });

  it('lets a focused range slider keep arrows, PageUp/PageDown, Home and End', () => {
    const slider = input('range');
    for (const key of ['ArrowUp', 'ArrowRight', 'PageDown', 'PageUp', 'Home', 'End']) {
      expect(resolveShortcut(keyEvent(key, { target: slider }))).toBeNull();
    }
    expect(resolveShortcut(keyEvent('+', { target: slider }))).toBe('faster');
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
