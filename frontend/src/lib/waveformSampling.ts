/**
 * Downsamples a raw audio buffer into `points` evenly-spaced signed sample values —
 * enough to draw a recognizable "wiggle" for this tick's ~50ms slice of audio without
 * pushing all 4096 raw samples into the scrolling waveform buffer every tick.
 */
export function downsampleWaveform(buffer: Float32Array, points: number): number[] {
  const stride = buffer.length / points;
  const samples: number[] = [];
  for (let i = 0; i < points; i++) {
    samples.push(buffer[Math.floor(i * stride)]);
  }
  return samples;
}
