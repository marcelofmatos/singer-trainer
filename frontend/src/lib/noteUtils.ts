const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const A4_FREQUENCY = 440;
const A4_MIDI = 69;

export interface NoteInfo {
  noteName: string;
  octave: number;
  midiNumber: number;
  cents: number;
}

/** Converts a MIDI note number (69 = A4) to its frequency in Hz. */
export function noteToFrequency(midiNumber: number): number {
  return A4_FREQUENCY * Math.pow(2, (midiNumber - A4_MIDI) / 12);
}

/** Converts a frequency in Hz to the nearest note name/octave and the deviation in cents. */
export function frequencyToNote(frequency: number): NoteInfo {
  const midiNumberFloat = A4_MIDI + 12 * Math.log2(frequency / A4_FREQUENCY);
  const midiNumber = Math.round(midiNumberFloat);
  const cents = Math.round((midiNumberFloat - midiNumber) * 100);
  const noteName = NOTE_NAMES[((midiNumber % 12) + 12) % 12];
  const octave = Math.floor(midiNumber / 12) - 1;
  return { noteName, octave, midiNumber, cents };
}
