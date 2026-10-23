import { noteToFrequency } from '../lib/noteUtils';
import { CALIBRATION_GAP_MS, CALIBRATION_NOTE_MS, CALIBRATION_NOTES } from '../lib/latency';

const LEAD_IN_SECONDS = 0.1;
const CALIBRATION_GAIN = 0.2;
// Short fades so the tones start and end without clicks but keep a sharp onset.
const RAMP_SECONDS = 0.01;

/**
 * Schedules the calibration test notes and returns each one's planned start in the now() clock,
 * so the caller can compare them with the times its input detected each note.
 */
export function playCalibrationSequence(context: AudioContext, now: () => number): number[] {
  const nowMs = now();
  const firstStart = context.currentTime + LEAD_IN_SECONDS;
  const noteSeconds = CALIBRATION_NOTE_MS / 1000;
  const stepSeconds = (CALIBRATION_NOTE_MS + CALIBRATION_GAP_MS) / 1000;

  return CALIBRATION_NOTES.map((midiNumber, index) => {
    const start = firstStart + index * stepSeconds;
    const end = start + noteSeconds;

    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(noteToFrequency(midiNumber), start);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(CALIBRATION_GAIN, start + RAMP_SECONDS);
    gain.gain.setValueAtTime(CALIBRATION_GAIN, end - RAMP_SECONDS);
    gain.gain.linearRampToValueAtTime(0, end);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end);

    return nowMs + (start - context.currentTime) * 1000;
  });
}
