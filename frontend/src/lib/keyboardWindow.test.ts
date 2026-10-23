import { describe, expect, it } from 'vitest';
import { keyboardOffsetPercent } from './keyboardWindow';

describe('keyboardOffsetPercent', () => {
  it('centers a white key in the 14-white-key window (C4 on C2–C6)', () => {
    // C4 is white key 14 of 29: center 14.5, window starts at 7.5 → −7.5/29.
    expect(keyboardOffsetPercent(60)).toBeCloseTo((-7.5 / 29) * 100, 5);
  });

  it('centers a black key on the boundary it sits over', () => {
    // C#4 sits over the C4/D4 boundary at x = 15 → window starts at 8.
    expect(keyboardOffsetPercent(61)).toBeCloseTo((-8 / 29) * 100, 5);
  });

  it('stops at the low end instead of showing empty space', () => {
    expect(keyboardOffsetPercent(36)).toBe(0);
    expect(keyboardOffsetPercent(45)).toBe(0);
    expect(keyboardOffsetPercent(20)).toBe(0);
  });

  it('stops at the high end instead of showing empty space', () => {
    const end = (-15 / 29) * 100;
    expect(keyboardOffsetPercent(84)).toBeCloseTo(end, 5);
    expect(keyboardOffsetPercent(80)).toBeCloseTo(end, 5);
    expect(keyboardOffsetPercent(100)).toBeCloseTo(end, 5);
  });

  it('honours a custom range and window size', () => {
    // C4–B5 has 14 white keys; a 7-key window centered on G4 (white 4, center 4.5) starts at 1.
    expect(keyboardOffsetPercent(67, 60, 83, 7)).toBeCloseTo((-1 / 14) * 100, 5);
  });
});
