import { describe, expect, it } from 'vitest';
import { appendSample, pitchRange, targetAt, voiceBlocks, voiceSamples, type RollSample } from './pianoRoll';
import type { TuningStatus } from './tuningGauge';

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

  it('replaces the readings at or after a new one, so a latency raised mid-stream keeps time moving forward', () => {
    const samples = [sample(100, 60, 60), sample(150, 60, 60), sample(200, 60, 60)];
    expect(appendSample(samples, sample(120, 62, 62), 6000).map((entry) => entry.time)).toEqual([100, 120]);
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

describe('voiceBlocks', () => {
  // Rows 60..71, 10 units tall; 1 unit per ms so x(time) === time.
  const geometry = { low: 60, high: 71, rowHeight: 10, tickMs: 50, left: 0, x: (time: number) => time };
  const rowCenter = (midi: number) => (71 - midi) * 10 + 5;
  const voiced = (time: number, voice: number | null, status: TuningStatus | null = 'in-tune'): RollSample => ({
    time,
    voice,
    target: null,
    status: voice === null ? null : status,
  });

  it('fills the whole row of the rounded note at fill 1', () => {
    const [block] = voiceBlocks([voiced(100, 64.3)], 1, geometry);
    expect(block.height).toBe(10);
    expect(block.y + block.height / 2).toBeCloseTo(rowCenter(64));
    expect(block.status).toBe('in-tune');
  });

  it('draws a stroke-thin strip at the exact pitch at fill 0', () => {
    const [block] = voiceBlocks([voiced(100, 64.3)], 0, geometry);
    expect(block.height).toBeCloseTo(2.5);
    expect(block.y + block.height / 2).toBeCloseTo(rowCenter(64.3));
  });

  it('interpolates height and centre at fill 0.5', () => {
    const [block] = voiceBlocks([voiced(100, 64.3)], 0.5, geometry);
    expect(block.height).toBeCloseTo(2.5 + 0.5 * (10 - 2.5));
    expect(block.y + block.height / 2).toBeCloseTo((rowCenter(64.3) + rowCenter(64)) / 2);
  });

  it('spans from the previous sample to this one, the first one a tick wide clamped to the left edge', () => {
    const blocks = voiceBlocks([voiced(30, 64), voiced(80, 64.4)], 0, geometry);
    expect(blocks.map((block) => [block.x, block.width])).toEqual([
      [0, 30],
      [30, 50],
    ]);
  });

  it('draws nothing for silence or pitches outside the range', () => {
    expect(voiceBlocks([voiced(100, null), voiced(150, 80), voiced(200, 50)], 1, geometry)).toEqual([]);
  });

  it('merges neighbouring blocks with the same row and status at fill 1 only', () => {
    const samples = [voiced(50, 64.1), voiced(100, 63.8), voiced(150, 64.2, 'close'), voiced(200, null), voiced(250, 64)];
    const full = voiceBlocks(samples, 1, geometry);
    expect(full.map((block) => [block.x, block.width, block.status])).toEqual([
      [0, 100, 'in-tune'],
      [100, 50, 'close'],
      [200, 50, 'in-tune'],
    ]);
    expect(voiceBlocks(samples, 0.9, geometry)).toHaveLength(4);
  });

  it('keeps each sample status', () => {
    const statuses = voiceBlocks([voiced(50, 64, 'in-tune'), voiced(100, 64, 'close'), voiced(150, 64, 'off')], 1, geometry).map(
      (block) => block.status
    );
    expect(statuses).toEqual(['in-tune', 'close', 'off']);
  });
});

describe('targetAt', () => {
  const targets = [
    { time: 100, target: 60 },
    { time: 200, target: null },
    { time: 300, target: 62 },
  ];

  it('is the last target reading at or before the time', () => {
    expect(targetAt(targets, 150)).toBe(60);
    expect(targetAt(targets, 250)).toBeNull();
    expect(targetAt(targets, 300)).toBe(62);
    expect(targetAt(targets, 900)).toBe(62);
  });

  it('is null before the first reading', () => {
    expect(targetAt(targets, 50)).toBeNull();
    expect(targetAt([], 50)).toBeNull();
  });
});

describe('voiceSamples', () => {
  const note = (midiNumber: number, cents = 0) => ({ noteName: 'X', octave: 0, midiNumber, cents });

  it('colours each voice reading against the target of its own time', () => {
    const voices = [
      { time: 100, note: note(60) },
      { time: 200, note: note(60) },
      { time: 300, note: null },
    ];
    const targets = [
      { time: 100, target: 60 },
      { time: 150, target: 64 },
    ];
    expect(voiceSamples(voices, targets)).toEqual([
      { time: 100, voice: 60, target: null, status: 'in-tune' },
      { time: 200, voice: 60, target: null, status: 'off' },
      { time: 300, voice: null, target: null, status: null },
    ]);
  });

  it('falls back to the nearest-note status without a target', () => {
    expect(voiceSamples([{ time: 100, note: note(60, 30) }], [])[0].status).toBe('off');
    expect(voiceSamples([{ time: 100, note: note(60, 3) }], [{ time: 200, target: 64 }])[0].status).toBe('in-tune');
  });
});
