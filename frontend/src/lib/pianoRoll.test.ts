import { describe, expect, it } from 'vitest';
import { appendSample, pitchRange, type RollSample } from './pianoRoll';

const sample = (time: number, voice: number | null, target: number | null): RollSample => ({
  time,
  voice,
  target,
  status: voice === null ? null : 'in-tune',
});

describe('appendSample', () => {
  it('keeps only the samples inside the window', () => {
    let samples: RollSample[] = [];
    for (let time = 0; time <= 7000; time += 1000) samples = appendSample(samples, sample(time, 60, 60), 6000);
    expect(samples.map((entry) => entry.time)).toEqual([1000, 2000, 3000, 4000, 5000, 6000, 7000]);
  });
});

describe('pitchRange', () => {
  it('covers voice and target with 2 semitones of margin, at least 12 semitones tall', () => {
    expect(pitchRange([sample(0, 60.3, 62)])).toEqual({ low: 55, high: 67 });
    expect(pitchRange([sample(0, 48, 60), sample(1, null, 64)])).toEqual({ low: 46, high: 66 });
  });

  it('falls back to C4–C5 when there is nothing to show', () => {
    expect(pitchRange([])).toEqual({ low: 60, high: 72 });
  });
});
