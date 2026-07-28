export interface PitchResult {
  frequency: number;
  probability: number;
}

export const DEFAULT_THRESHOLD = 0.15;

/**
 * YIN pitch detection (de Cheveigné & Kawahara, 2002).
 * Returns null when no clear periodicity is found (silence/unvoiced audio).
 */
export function detectPitchYIN(
  buffer: Float32Array,
  sampleRate: number,
  threshold: number = DEFAULT_THRESHOLD
): PitchResult | null {
  const halfBufferSize = Math.floor(buffer.length / 2);
  const yinBuffer = new Float32Array(halfBufferSize);

  // Step 1: difference function
  for (let tau = 0; tau < halfBufferSize; tau++) {
    let sum = 0;
    for (let i = 0; i < halfBufferSize; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    yinBuffer[tau] = sum;
  }

  // Step 2: cumulative mean normalized difference function
  yinBuffer[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfBufferSize; tau++) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] = runningSum === 0 ? 1 : (yinBuffer[tau] * tau) / runningSum;
  }

  // Step 3: absolute threshold — first dip below threshold, walked to its local minimum
  let tauEstimate = -1;
  for (let tau = 2; tau < halfBufferSize; tau++) {
    if (yinBuffer[tau] < threshold) {
      while (tau + 1 < halfBufferSize && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) {
    return null;
  }

  // Step 4: parabolic interpolation around the estimate for sub-sample accuracy
  const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
  const x2 = tauEstimate + 1 < halfBufferSize ? tauEstimate + 1 : tauEstimate;

  let betterTau = tauEstimate;
  if (x0 !== tauEstimate && x2 !== tauEstimate) {
    const s0 = yinBuffer[x0];
    const s1 = yinBuffer[tauEstimate];
    const s2 = yinBuffer[x2];
    const denominator = 2 * (2 * s1 - s2 - s0);
    if (denominator !== 0) {
      betterTau = tauEstimate + (s2 - s0) / denominator;
    }
  }

  return {
    frequency: sampleRate / betterTau,
    probability: 1 - yinBuffer[tauEstimate],
  };
}
