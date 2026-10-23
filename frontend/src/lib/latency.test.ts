import { describe, expect, it } from 'vitest';
import {
  CALIBRATION_GAP_MS,
  CALIBRATION_NOTES,
  CALIBRATION_NOTE_MS,
  clampLatency,
  DETECTION_WINDOW_MS,
  estimateLatency,
  MAX_LATENCY_MS,
  MIN_DETECTED,
} from './latency';

describe('latency constants', () => {
  it('describes the calibration sequence', () => {
    expect(CALIBRATION_NOTES).toEqual([60, 67, 60, 67, 60, 67]);
    expect(CALIBRATION_NOTE_MS).toBe(350);
    expect(CALIBRATION_GAP_MS).toBe(150);
    expect(MAX_LATENCY_MS).toBe(1000);
    expect(MIN_DETECTED).toBe(3);
    expect(DETECTION_WINDOW_MS).toBe(1000);
  });
});

describe('clampLatency', () => {
  it('rounds to 10 ms and clamps to [0, 1000]', () => {
    expect(clampLatency(184)).toBe(180);
    expect(clampLatency(185)).toBe(190);
    expect(clampLatency(-50)).toBe(0);
    expect(clampLatency(5000)).toBe(1000);
  });

  it('treats non-finite values as 0', () => {
    expect(clampLatency(NaN)).toBe(0);
    expect(clampLatency(Infinity)).toBe(0);
    expect(clampLatency(-Infinity)).toBe(0);
  });
});

describe('estimateLatency', () => {
  const onsets = (midis: number[]) => midis.map((midi, i) => ({ time: i * 500, midi }));

  it('returns the median of the matched delays, rounded', () => {
    const o = onsets([60, 67, 60, 67]);
    const d = [170, 190, 180, 200].map((delay, i) => ({ time: o[i].time + delay, midi: o[i].midi }));
    expect(estimateLatency(o, d)).toBe(190);
  });

  it('matches any octave of the same pitch class', () => {
    const o = onsets([60, 67, 60]);
    const d = o.map((x) => ({ time: x.time + 200, midi: x.midi + 12 }));
    expect(estimateLatency(o, d)).toBe(200);
  });

  it('returns null with fewer than 3 matches', () => {
    const o = onsets([60, 67, 60]);
    const d = o.slice(0, 2).map((x) => ({ time: x.time + 200, midi: x.midi }));
    expect(estimateLatency(o, d)).toBeNull();
  });

  it('ignores other notes, null detections and detections before the onset', () => {
    const o = onsets([60, 67, 60]);
    const d = [
      { time: -10, midi: 60 },
      { time: 100, midi: 62 },
      { time: 120, midi: null },
      ...o.map((x) => ({ time: x.time + 200, midi: x.midi })),
    ];
    expect(estimateLatency(o, d)).toBe(200);
  });

  it('uses the first matching detection only', () => {
    const o = [{ time: 0, midi: 60 }, { time: 2000, midi: 60 }, { time: 4000, midi: 60 }];
    const d = o.flatMap((x) => [
      { time: x.time + 100, midi: 60 },
      { time: x.time + 500, midi: 60 },
    ]);
    expect(estimateLatency(o, d)).toBe(100);
  });

  it('only accepts detections within the window', () => {
    const o = [{ time: 0, midi: 60 }, { time: 2000, midi: 60 }, { time: 4000, midi: 60 }];
    const inside = o.map((x) => ({ time: x.time + 1000, midi: 60 }));
    expect(estimateLatency(o, inside)).toBe(1000);
    const outside = o.map((x) => ({ time: x.time + 1001, midi: 60 }));
    expect(estimateLatency(o, outside)).toBeNull();
  });

  it('rounds the median to 10 ms', () => {
    const o = onsets([60, 67, 60]);
    const d = o.map((x) => ({ time: x.time + 184, midi: x.midi }));
    expect(estimateLatency(o, d)).toBe(180);
  });
});
