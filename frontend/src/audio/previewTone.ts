import { noteToFrequency } from '../lib/noteUtils';

const PREVIEW_DURATION_SECONDS = 0.5;
// Louder than the reference tone's 0.15 — a one-off click preview isn't competing
// with the singer's own voice/mic input the way a continuous reference tone is.
const PREVIEW_GAIN = 0.2;

/** Plays a single short tone for the given MIDI note — used to preview a note on click. */
export function playPreviewTone(audioContext: AudioContext, midiNumber: number): void {
  const oscillator = audioContext.createOscillator();
  oscillator.type = 'sine';

  const gain = audioContext.createGain();
  gain.gain.value = PREVIEW_GAIN;

  oscillator.connect(gain).connect(audioContext.destination);

  const startTime = audioContext.currentTime;
  oscillator.frequency.setValueAtTime(noteToFrequency(midiNumber), startTime);
  oscillator.start(startTime);
  oscillator.stop(startTime + PREVIEW_DURATION_SECONDS);
}
