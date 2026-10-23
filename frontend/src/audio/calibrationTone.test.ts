import { describe, expect, it, vi } from 'vitest';
import { playCalibrationSequence } from './calibrationTone';
import { CALIBRATION_GAP_MS, CALIBRATION_NOTE_MS, CALIBRATION_NOTES } from '../lib/latency';

function mockContext(currentTime: number) {
  const oscillators: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; type: string }[] = [];
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
  const context = {
    currentTime,
    destination: {},
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: '',
        frequency: param(),
        connect: vi.fn((node: unknown) => node),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => ({ gain: param(), connect: vi.fn((node: unknown) => node) })),
  };
  return { context: context as unknown as AudioContext, oscillators };
}

describe('playCalibrationSequence', () => {
  it('schedules one sine oscillator per test note', () => {
    const { context, oscillators } = mockContext(2);
    playCalibrationSequence(context, () => 10_000);
    expect(oscillators).toHaveLength(CALIBRATION_NOTES.length);
    oscillators.forEach((oscillator) => expect(oscillator.type).toBe('sine'));
    const first = oscillators[0].start.mock.calls[0][0] as number;
    expect(first).toBeGreaterThan(2);
    expect(oscillators[0].stop.mock.calls[0][0]).toBeCloseTo(first + CALIBRATION_NOTE_MS / 1000);
    expect(oscillators[1].start.mock.calls[0][0]).toBeCloseTo(first + (CALIBRATION_NOTE_MS + CALIBRATION_GAP_MS) / 1000);
  });

  it('returns each planned start in the now() clock, 500 ms apart and slightly ahead', () => {
    const { context } = mockContext(2);
    const onsets = playCalibrationSequence(context, () => 10_000);
    expect(onsets).toHaveLength(CALIBRATION_NOTES.length);
    expect(onsets[0]).toBeGreaterThan(10_000);
    expect(onsets[0]).toBeLessThanOrEqual(10_200);
    onsets.slice(1).forEach((onset, i) => expect(onset - onsets[i]).toBeCloseTo(500));
  });
});
