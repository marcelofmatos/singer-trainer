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

  it('ignores voice values outside a plausible singing range', () => {
    const base = [sample(0, 60, null), sample(1, 62, null)];
    expect(pitchRange([...base, sample(2, 100, null)])).toEqual(pitchRange(base));
    expect(pitchRange([...base, sample(2, 20, null)])).toEqual(pitchRange(base));
  });

  it('is not dragged by a single stray voice value', () => {
    const around = Array.from({ length: 20 }, (_, index) => sample(index, 60 + (index % 3), null));
    expect(pitchRange([...around, sample(20, 40, null)])).toEqual(pitchRange(around));
  });

  it('always includes targets in full', () => {
    expect(pitchRange([sample(0, 60, 100)]).high).toBe(102);
  });

  it('falls back to C4–C5 when there is nothing to show', () => {
    expect(pitchRange([])).toEqual({ low: 60, high: 72 });
  });
});
