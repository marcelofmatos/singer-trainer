export const CHROMATIC_NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

/**
 * One fixed color per pitch class, evenly stepped around the hue wheel
 * (H = index*30°, S=70%, L=55%) — this is a positional reference wheel where
 * every bubble is always labeled with its note name, not a data-identity
 * legend, so a full-spectrum ramp is the right choice here (see the design
 * spec for the rationale).
 */
export const CHROMATIC_NOTE_COLORS = [
  '#DD3C3C', '#DD8C3C', '#DDDD3C', '#8CDD3C',
  '#3CDD3C', '#3CDD8C', '#3CDDDD', '#3C8CDD',
  '#3C3CDD', '#8C3CDD', '#DD3CDD', '#DD3C8C',
];

export const DEGREES_PER_SEMITONE = 30;

/** Maps a MIDI note number to its pitch class (0=C .. 11=B), ignoring octave. */
export function pitchClassIndex(midiNumber: number): number {
  return ((midiNumber % 12) + 12) % 12;
}

/**
 * Angle in degrees, clockwise from the top (12 o'clock = C), for a pitch class
 * plus a sub-semitone cents offset. NOT normalized to [0, 360) — this lets
 * adjacent-octave transitions (e.g. B mostly-sharp -> C mostly-flat) stay
 * numerically continuous; call normalizeAngle if you need a fixed range.
 */
export function angleForPitch(midiNumber: number, cents: number): number {
  return pitchClassIndex(midiNumber) * DEGREES_PER_SEMITONE + (cents / 100) * DEGREES_PER_SEMITONE;
}

/** Wraps an angle in degrees into the [0, 360) range. */
export function normalizeAngle(angleDegrees: number): number {
  return ((angleDegrees % 360) + 360) % 360;
}

export interface Point {
  x: number;
  y: number;
}

/** Converts an angle (degrees, clockwise from the top) to an x/y point on a circle. */
export function pointOnCircle(angleDegrees: number, radius: number, center: Point): Point {
  const angleRad = (angleDegrees * Math.PI) / 180;
  return {
    x: center.x + radius * Math.sin(angleRad),
    y: center.y - radius * Math.cos(angleRad),
  };
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Picks black or white text for the highest WCAG contrast on a given hex background. */
export function readableTextColor(hex: string): '#000000' | '#ffffff' {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const backgroundLuminance = relativeLuminance(r, g, b);
  const contrastWithBlack = contrastRatio(backgroundLuminance, relativeLuminance(0, 0, 0));
  const contrastWithWhite = contrastRatio(backgroundLuminance, relativeLuminance(255, 255, 255));
  return contrastWithBlack >= contrastWithWhite ? '#000000' : '#ffffff';
}
