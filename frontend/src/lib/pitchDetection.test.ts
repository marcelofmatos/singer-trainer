import { describe, expect, it } from 'vitest';
import { detectPitchYIN } from './pitchDetection';

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 4096;

function generateSineWave(frequency: number, sampleRate: number, length: number): Float32Array {
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buffer;
}

describe('detectPitchYIN', () => {
  it('detects a 440Hz sine wave (A4) within 2Hz', () => {
    const buffer = generateSineWave(440, SAMPLE_RATE, BUFFER_SIZE);
    const result = detectPitchYIN(buffer, SAMPLE_RATE);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.frequency - 440)).toBeLessThan(2);
  });

  it('detects a 110Hz sine wave (A2, low male voice range) within 2Hz', () => {
    const buffer = generateSineWave(110, SAMPLE_RATE, BUFFER_SIZE);
    const result = detectPitchYIN(buffer, SAMPLE_RATE);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.frequency - 110)).toBeLessThan(2);
  });

  it('detects a 880Hz sine wave (A5, high voice range) within 4Hz', () => {
    const buffer = generateSineWave(880, SAMPLE_RATE, BUFFER_SIZE);
    const result = detectPitchYIN(buffer, SAMPLE_RATE);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.frequency - 880)).toBeLessThan(4);
  });

  it('returns null for silence', () => {
    const buffer = new Float32Array(BUFFER_SIZE);
    const result = detectPitchYIN(buffer, SAMPLE_RATE);
    expect(result).toBeNull();
  });
});
