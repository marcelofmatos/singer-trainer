/**
 * Downsamples a raw audio buffer into `points` evenly-spaced signed sample values —
 * enough to draw a recognizable "wiggle" for this tick's ~93ms window of audio (4096
 * samples at 44.1kHz) without pushing every raw sample into the scrolling waveform
 * buffer every tick.
 */
export function downsampleWaveform(buffer: Float32Array, points: number): number[] {
  const stride = buffer.length / points;
  const samples: number[] = [];
  for (let i = 0; i < points; i++) {
    samples.push(buffer[Math.floor(i * stride)]);
  }
  return samples;
}
