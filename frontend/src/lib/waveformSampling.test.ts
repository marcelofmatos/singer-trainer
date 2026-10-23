import { describe, expect, it } from 'vitest';
import { downsampleWaveform } from './waveformSampling';

describe('downsampleWaveform', () => {
  it('returns the requested number of points', () => {
    const buffer = new Float32Array(16);
    const result = downsampleWaveform(buffer, 4);
    expect(result.length).toBe(4);
  });

  it('picks the largest-magnitude sample of each chunk, preserving sign', () => {
    const buffer = Float32Array.from([0, 0.1, -0.2, 0.3, -0.4, 0.5, -0.9, 0.7]);
    // 8 samples, 4 points -> chunks of 2
    const result = downsampleWaveform(buffer, 4);
    expect(result.length).toBe(4);
    expect(result[0]).toBeCloseTo(0.1, 5);
    expect(result[1]).toBeCloseTo(0.3, 5);
    expect(result[2]).toBeCloseTo(0.5, 5);
    expect(result[3]).toBeCloseTo(-0.9, 5);
  });

  it('returns the buffer as-is when points equals buffer length', () => {
    const buffer = Float32Array.from([1, 2, 3, 4]);
    const result = downsampleWaveform(buffer, 4);
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it('keeps the peak of each chunk, not a strided pick', () => {
    const buffer = new Float32Array(16);
    buffer[5] = 0.8; // middle of chunk 1 (indices 4-7); a stride-4 pick would hit 0
    buffer[10] = -0.9; // chunk 2 (indices 8-11), negative peak keeps its sign
    expect(downsampleWaveform(buffer, 4)).toEqual([
      0,
      expect.closeTo(0.8, 5),
      expect.closeTo(-0.9, 5),
      0,
    ]);
  });
});
