import { describe, expect, it } from 'vitest';
import {
  CHROMATIC_NOTE_COLORS,
  CHROMATIC_NOTE_NAMES,
  angleForPitch,
  normalizeAngle,
  pitchClassIndex,
  pointOnCircle,
  readableTextColor,
} from './chromaticWheel';

describe('pitchClassIndex', () => {
  it('maps MIDI numbers to 0-11 pitch classes', () => {
    expect(pitchClassIndex(60)).toBe(0); // C4
    expect(pitchClassIndex(61)).toBe(1); // C#4
    expect(pitchClassIndex(71)).toBe(11); // B4
    expect(pitchClassIndex(72)).toBe(0); // C5 wraps back to C
  });

  it('handles negative MIDI numbers safely', () => {
    expect(pitchClassIndex(-1)).toBe(11);
  });
});

describe('angleForPitch', () => {
  it('places each pitch class 30 degrees apart, starting at 0 for C', () => {
    expect(angleForPitch(60, 0)).toBe(0); // C
    expect(angleForPitch(61, 0)).toBe(30); // C#
    expect(angleForPitch(69, 0)).toBe(270); // A
  });

  it('offsets within a semitone proportionally to cents', () => {
    expect(angleForPitch(60, 50)).toBe(15); // halfway from C to C#
    expect(angleForPitch(60, -50)).toBe(-15); // halfway from C back to B
  });

  it('is continuous across the B-to-C wraparound (no visual jump)', () => {
    const justBelowC5 = angleForPitch(71, 50); // B4, 50 cents sharp
    const justAboveB4 = angleForPitch(72, -50); // C5, 50 cents flat
    expect(normalizeAngle(justBelowC5)).toBeCloseTo(normalizeAngle(justAboveB4), 5);
  });
});

describe('normalizeAngle', () => {
  it('wraps angles into the [0, 360) range', () => {
    expect(normalizeAngle(-15)).toBe(345);
    expect(normalizeAngle(345)).toBe(345);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(390)).toBe(30);
  });
});

describe('pointOnCircle', () => {
  const center = { x: 100, y: 100 };

  it('places 0 degrees at the top of the circle', () => {
    const point = pointOnCircle(0, 100, center);
    expect(point.x).toBeCloseTo(100, 5);
    expect(point.y).toBeCloseTo(0, 5);
  });

  it('places 90 degrees at the right of the circle (clockwise from top)', () => {
    const point = pointOnCircle(90, 100, center);
    expect(point.x).toBeCloseTo(200, 5);
    expect(point.y).toBeCloseTo(100, 5);
  });

  it('places 180 degrees at the bottom of the circle', () => {
    const point = pointOnCircle(180, 100, center);
    expect(point.x).toBeCloseTo(100, 5);
    expect(point.y).toBeCloseTo(200, 5);
  });

  it('places 270 degrees at the left of the circle', () => {
    const point = pointOnCircle(270, 100, center);
    expect(point.x).toBeCloseTo(0, 5);
    expect(point.y).toBeCloseTo(100, 5);
  });
});

describe('CHROMATIC_NOTE_NAMES / CHROMATIC_NOTE_COLORS', () => {
  it('has exactly 12 names and 12 matching colors, one per pitch class', () => {
    expect(CHROMATIC_NOTE_NAMES).toHaveLength(12);
    expect(CHROMATIC_NOTE_COLORS).toHaveLength(12);
    expect(CHROMATIC_NOTE_NAMES[0]).toBe('C');
    expect(CHROMATIC_NOTE_NAMES[11]).toBe('B');
  });
});

describe('readableTextColor', () => {
  it('picks dark text on a light background', () => {
    expect(readableTextColor('#DDDD3C')).toBe('#000000'); // pale yellow
  });

  it('picks light text on a dark/saturated background', () => {
    expect(readableTextColor('#3C3CDD')).toBe('#ffffff'); // deep blue
  });
});
