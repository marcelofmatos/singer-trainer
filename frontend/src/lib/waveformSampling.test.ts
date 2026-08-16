import { describe, expect, it } from 'vitest';
import { downsampleWaveform } from './waveformSampling';

describe('downsampleWaveform', () => {
  it('returns the requested number of points', () => {
    const buffer = new Float32Array(16);
    const result = downsampleWaveform(buffer, 4);
    expect(result.length).toBe(4);
  });

  it('picks values at fixed stride positions, preserving sign', () => {
    // buffer index:  0    1    2    3    4    5    6    7
    const buffer = Float32Array.from([0, 0.1, -0.2, 0.3, -0.4, 0.5, -0.6, 0.7]);
    // 8 samples, 4 points -> stride 2 -> indices 0, 2, 4, 6
    const result = downsampleWaveform(buffer, 4);
    expect(result.length).toBe(4);
    expect(result[0]).toBe(0);
    expect(result[1]).toBeCloseTo(-0.2, 5);
    expect(result[2]).toBeCloseTo(-0.4, 5);
    expect(result[3]).toBeCloseTo(-0.6, 5);
  });

  it('returns the buffer as-is when points equals buffer length', () => {
    const buffer = Float32Array.from([1, 2, 3, 4]);
    const result = downsampleWaveform(buffer, 4);
    expect(result).toEqual([1, 2, 3, 4]);
  });
});
