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

const DEGREES_PER_SEMITONE = 30;

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

/** Picks black or white text for readable contrast on a given hex background color. */
export function readableTextColor(hex: string): '#000000' | '#ffffff' {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 128 ? '#000000' : '#ffffff';
}
