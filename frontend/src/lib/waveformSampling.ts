/**
 * Downsamples a raw audio buffer into `points` values, one per equal chunk: the sample
 * with the largest absolute value in that chunk (sign kept). Peak picking keeps the
 * waveform's envelope visible for this tick's ~93ms window (4096 samples at 44.1kHz),
 * which a strided pick would mostly miss.
 */
export function downsampleWaveform(buffer: Float32Array, points: number): number[] {
  const chunk = buffer.length / points;
  const samples: number[] = [];
  for (let i = 0; i < points; i++) {
    const start = Math.floor(i * chunk);
    const end = Math.max(Math.floor((i + 1) * chunk), start + 1);
    let peak = buffer[start];
    for (let j = start + 1; j < end; j++) {
      if (Math.abs(buffer[j]) > Math.abs(peak)) peak = buffer[j];
    }
    samples.push(peak);
  }
  return samples;
}
