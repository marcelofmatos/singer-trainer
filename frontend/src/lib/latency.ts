/** MIDI notes played by the calibration, in order (C4 and G4 alternating). */
export const CALIBRATION_NOTES = [60, 67, 60, 67, 60, 67];
export const CALIBRATION_NOTE_MS = 350;
export const CALIBRATION_GAP_MS = 150;
export const MAX_LATENCY_MS = 1000;
/** Minimum number of test notes the input must have caught for the measurement to count. */
export const MIN_DETECTED = 3;
export const DETECTION_WINDOW_MS = 1000;

/** Latency rounded to 10 ms and limited to [0, MAX_LATENCY_MS]; non-finite becomes 0. */
export function clampLatency(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.min(MAX_LATENCY_MS, Math.max(0, Math.round(ms / 10) * 10));
}

const samePitchClass = (a: number, b: number): boolean => (((a - b) % 12) + 12) % 12 === 0;

/**
 * Input latency from the calibration run: median delay between each test-note onset and the
 * first detection of the same pitch class (any octave) within the window. Null when fewer than
 * MIN_DETECTED notes were caught.
 */
export function estimateLatency(
  onsets: { time: number; midi: number }[],
  detections: { time: number; midi: number | null }[]
): number | null {
  const delays: number[] = [];
  for (const onset of onsets) {
    const hit = detections.find(
      (d) =>
        d.midi !== null &&
        d.time >= onset.time &&
        d.time <= onset.time + DETECTION_WINDOW_MS &&
        samePitchClass(d.midi, onset.midi)
    );
    if (hit) delays.push(hit.time - onset.time);
  }
  if (delays.length < MIN_DETECTED) return null;
  delays.sort((a, b) => a - b);
  const mid = delays.length >> 1;
  const median = delays.length % 2 ? delays[mid] : (delays[mid - 1] + delays[mid]) / 2;
  return clampLatency(median);
}
