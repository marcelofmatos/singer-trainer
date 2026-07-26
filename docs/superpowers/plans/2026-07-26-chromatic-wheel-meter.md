# Chromatic Wheel Pitch Meter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current "note name + horizontal bar" tuning display with a circular chromatic wheel (12 note bubbles arranged like a clock, colored, with a live-moving indicator) — a display that doesn't require the user to already know note names or cents to understand "how close am I."

**Architecture:** A new pure geometry/color module (`chromaticWheel.ts`) computes angles and screen positions for the 12 chromatic pitch classes and for the live-detected pitch (continuous, not snapped) — fully unit-testable with synthetic MIDI/cents values, no DOM involved. `PitchMeter.tsx` is rewritten to render an SVG using that module: 12 fixed colored bubbles (one per pitch class), the exercise's target bubble highlighted, and a moving indicator dot colored by tuning status (reusing the existing `tuningGauge.ts` logic unchanged). `PitchMeter`'s public props (`PitchMeterProps`) are unchanged, so `ExercisePlayer.tsx` needs no changes at all.

**Tech Stack:** Same as the rest of the frontend — React + TypeScript, inline SVG (no charting/graphics library needed), Vitest + Testing Library for tests.

**Design reference:** `docs/superpowers/specs/2026-07-26-chromatic-wheel-meter-design.md` (approved spec — read for the full rationale, including why a chromatic circle was chosen over a circle-of-fifths layout, and the accepted octave-blindness limitation of any 12-position wheel).

---

### Task 1: Chromatic wheel geometry and color module

**Files:**
- Create: `frontend/src/lib/chromaticWheel.ts`
- Test: `frontend/src/lib/chromaticWheel.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/lib/chromaticWheel.test.ts
import { describe, expect, it } from 'vitest';
import {
  CHROMATIC_NOTE_COLORS,
  CHROMATIC_NOTE_NAMES,
  angleForPitch,
  normalizeAngle,
  pitchClassIndex,
  pointOnCircle,
  readableTextColor,
} from './chromaticWheel';

describe('pitchClassIndex', () => {
  it('maps MIDI numbers to 0-11 pitch classes', () => {
    expect(pitchClassIndex(60)).toBe(0); // C4
    expect(pitchClassIndex(61)).toBe(1); // C#4
    expect(pitchClassIndex(71)).toBe(11); // B4
    expect(pitchClassIndex(72)).toBe(0); // C5 wraps back to C
  });

  it('handles negative MIDI numbers safely', () => {
    expect(pitchClassIndex(-1)).toBe(11);
  });
});

describe('angleForPitch', () => {
  it('places each pitch class 30 degrees apart, starting at 0 for C', () => {
    expect(angleForPitch(60, 0)).toBe(0); // C
    expect(angleForPitch(61, 0)).toBe(30); // C#
    expect(angleForPitch(69, 0)).toBe(270); // A
  });

  it('offsets within a semitone proportionally to cents', () => {
    expect(angleForPitch(60, 50)).toBe(15); // halfway from C to C#
    expect(angleForPitch(60, -50)).toBe(-15); // halfway from C back to B
  });

  it('is continuous across the B-to-C wraparound (no visual jump)', () => {
    const justBelowC5 = angleForPitch(71, 50); // B4, 50 cents sharp
    const justAboveB4 = angleForPitch(72, -50); // C5, 50 cents flat
    expect(normalizeAngle(justBelowC5)).toBeCloseTo(normalizeAngle(justAboveB4), 5);
  });
});

describe('normalizeAngle', () => {
  it('wraps angles into the [0, 360) range', () => {
    expect(normalizeAngle(-15)).toBe(345);
    expect(normalizeAngle(345)).toBe(345);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(390)).toBe(30);
  });
});

describe('pointOnCircle', () => {
  const center = { x: 100, y: 100 };

  it('places 0 degrees at the top of the circle', () => {
    const point = pointOnCircle(0, 100, center);
    expect(point.x).toBeCloseTo(100, 5);
    expect(point.y).toBeCloseTo(0, 5);
  });

  it('places 90 degrees at the right of the circle (clockwise from top)', () => {
    const point = pointOnCircle(90, 100, center);
    expect(point.x).toBeCloseTo(200, 5);
    expect(point.y).toBeCloseTo(100, 5);
  });

  it('places 180 degrees at the bottom of the circle', () => {
    const point = pointOnCircle(180, 100, center);
    expect(point.x).toBeCloseTo(100, 5);
    expect(point.y).toBeCloseTo(200, 5);
  });

  it('places 270 degrees at the left of the circle', () => {
    const point = pointOnCircle(270, 100, center);
    expect(point.x).toBeCloseTo(0, 5);
    expect(point.y).toBeCloseTo(100, 5);
  });
});

describe('CHROMATIC_NOTE_NAMES / CHROMATIC_NOTE_COLORS', () => {
  it('has exactly 12 names and 12 matching colors, one per pitch class', () => {
    expect(CHROMATIC_NOTE_NAMES).toHaveLength(12);
    expect(CHROMATIC_NOTE_COLORS).toHaveLength(12);
    expect(CHROMATIC_NOTE_NAMES[0]).toBe('C');
    expect(CHROMATIC_NOTE_NAMES[11]).toBe('B');
  });
});

describe('readableTextColor', () => {
  it('picks dark text on a light background', () => {
    expect(readableTextColor('#DDDD3C')).toBe('#000000'); // pale yellow
  });

  it('picks light text on a dark/saturated background', () => {
    expect(readableTextColor('#3C3CDD')).toBe('#ffffff'); // deep blue
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- chromaticWheel`
Expected: FAIL with a module-not-found error for `./chromaticWheel`.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/chromaticWheel.ts
export const CHROMATIC_NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

/**
 * One fixed color per pitch class, evenly stepped around the hue wheel
 * (H = index*30°, S=70%, L=55%) — this is a positional reference wheel where
 * every bubble is always labeled with its note name, not a data-identity
 * legend, so a full-spectrum ramp is the right choice here (see the design
 * spec for the rationale).
 */
export const CHROMATIC_NOTE_COLORS = [
  '#DD3C3C', '#DD8C3C', '#DDDD3C', '#8CDD3C',
  '#3CDD3C', '#3CDD8C', '#3CDDDD', '#3C8CDD',
  '#3C3CDD', '#8C3CDD', '#DD3CDD', '#DD3C8C',
];

const DEGREES_PER_SEMITONE = 30;

/** Maps a MIDI note number to its pitch class (0=C .. 11=B), ignoring octave. */
export function pitchClassIndex(midiNumber: number): number {
  return ((midiNumber % 12) + 12) % 12;
}

/**
 * Angle in degrees, clockwise from the top (12 o'clock = C), for a pitch class
 * plus a sub-semitone cents offset. NOT normalized to [0, 360) — this lets
 * adjacent-octave transitions (e.g. B mostly-sharp -> C mostly-flat) stay
 * numerically continuous; call normalizeAngle if you need a fixed range.
 */
export function angleForPitch(midiNumber: number, cents: number): number {
  return pitchClassIndex(midiNumber) * DEGREES_PER_SEMITONE + (cents / 100) * DEGREES_PER_SEMITONE;
}

/** Wraps an angle in degrees into the [0, 360) range. */
export function normalizeAngle(angleDegrees: number): number {
  return ((angleDegrees % 360) + 360) % 360;
}

export interface Point {
  x: number;
  y: number;
}

/** Converts an angle (degrees, clockwise from the top) to an x/y point on a circle. */
export function pointOnCircle(angleDegrees: number, radius: number, center: Point): Point {
  const angleRad = (angleDegrees * Math.PI) / 180;
  return {
    x: center.x + radius * Math.sin(angleRad),
    y: center.y - radius * Math.cos(angleRad),
  };
}

/** Picks black or white text for readable contrast on a given hex background color. */
export function readableTextColor(hex: string): '#000000' | '#ffffff' {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 128 ? '#000000' : '#ffffff';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- chromaticWheel`
Expected: PASS — 13 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/chromaticWheel.ts frontend/src/lib/chromaticWheel.test.ts
git commit -m "feat: add chromatic wheel geometry and color module"
```

---

### Task 2: Rewrite PitchMeter as a chromatic wheel

**Files:**
- Modify: `frontend/src/components/PitchMeter.tsx` (full rewrite of the render — props stay the same)
- Modify: `frontend/src/components/PitchMeter.test.tsx` (full rewrite of the tests)

`ExercisePlayer.tsx` is NOT modified by this task — `PitchMeterProps` (`detectedNote`, `targetMidiNumber`) stays identical, so the existing call site keeps working unchanged.

- [ ] **Step 1: Replace `frontend/src/components/PitchMeter.test.tsx` with the new failing tests**

```tsx
// frontend/src/components/PitchMeter.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PitchMeter } from './PitchMeter';

describe('PitchMeter', () => {
  it('renders all 12 chromatic note bubbles', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} />);
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((name) => {
      expect(screen.getByTestId(`note-bubble-${name}`)).toBeDefined();
    });
  });

  it('shows no live indicator when no note is detected', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} />);
    expect(screen.queryByTestId('live-indicator')).toBeNull();
  });

  it('shows the live indicator once a note is detected', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByTestId('live-indicator')).toBeDefined();
  });

  it('marks the target note bubble as active and leaves others inactive', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByTestId('note-bubble-A').dataset.active).toBe('true');
    expect(screen.getByTestId('note-bubble-C').dataset.active).toBe('false');
  });

  it('labels the indicator as in tune when within 10 cents of the target', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('in-tune');
  });

  it('labels the indicator as off when far from the target', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 40 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('off');
  });

  it('accounts for whole-semitone offsets from the target, not just cents', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'G', octave: 4, midiNumber: 67, cents: 0 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('off');
  });

  it('falls back to nearest-chromatic-note tuning when no exercise target is active', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: -15 }}
        targetMidiNumber={null}
      />
    );
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('close');
    expect(screen.getByTestId('note-bubble-A').dataset.active).toBe('false');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- PitchMeter`
Expected: FAIL — the old text/bar implementation doesn't render any `note-bubble-*` or `live-indicator` test ids.

- [ ] **Step 3: Replace `frontend/src/components/PitchMeter.tsx`**

```tsx
// frontend/src/components/PitchMeter.tsx
import {
  CHROMATIC_NOTE_COLORS,
  CHROMATIC_NOTE_NAMES,
  DEGREES_PER_SEMITONE,
  angleForPitch,
  pitchClassIndex,
  pointOnCircle,
  readableTextColor,
} from '../lib/chromaticWheel';
import { tuningStatus } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';

export interface PitchMeterProps {
  detectedNote: NoteInfo | null;
  /** The exercise's current target note, if one is playing. */
  targetMidiNumber: number | null;
}

const VIEWBOX_SIZE = 240;
const CENTER = { x: VIEWBOX_SIZE / 2, y: VIEWBOX_SIZE / 2 };
const WHEEL_RADIUS = 90;
const BUBBLE_RADIUS = 22;
const INDICATOR_RADIUS = 10;

const STATUS_COLORS = {
  'in-tune': '#2ecc71',
  close: '#f1c40f',
  off: '#e74c3c',
} as const;

export function PitchMeter({ detectedNote, targetMidiNumber }: PitchMeterProps) {
  const targetPitchClass = targetMidiNumber !== null ? pitchClassIndex(targetMidiNumber) : null;

  // Cents relative to the exercise's target note (if any), otherwise relative to the
  // nearest chromatic note — drives the indicator's color only, not its position.
  const cents =
    detectedNote && targetMidiNumber !== null
      ? (detectedNote.midiNumber - targetMidiNumber) * 100 + detectedNote.cents
      : (detectedNote?.cents ?? 0);
  const status = detectedNote ? tuningStatus(cents) : null;

  // The indicator's position is always the *absolute* sung pitch (its own pitch class
  // plus its own cents) — this is what makes it slide continuously around the wheel.
  const indicatorPosition = detectedNote
    ? pointOnCircle(angleForPitch(detectedNote.midiNumber, detectedNote.cents), WHEEL_RADIUS, CENTER)
    : null;

  return (
    <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} width="100%" role="img" aria-label="Roda cromática de afinação">
      {CHROMATIC_NOTE_NAMES.map((name, index) => {
        const { x, y } = pointOnCircle(index * DEGREES_PER_SEMITONE, WHEEL_RADIUS, CENTER);
        const isTarget = targetPitchClass === index;
        const color = CHROMATIC_NOTE_COLORS[index];
        return (
          <g key={name} data-testid={`note-bubble-${name}`} data-active={isTarget ? 'true' : 'false'}>
            <circle
              cx={x}
              cy={y}
              r={isTarget ? BUBBLE_RADIUS + 4 : BUBBLE_RADIUS}
              fill={color}
              stroke={isTarget ? '#ffffff' : 'none'}
              strokeWidth={isTarget ? 3 : 0}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={readableTextColor(color)}
              fontSize="14"
            >
              {name}
            </text>
          </g>
        );
      })}
      {indicatorPosition && status && (
        <circle
          data-testid="live-indicator"
          data-status={status}
          cx={indicatorPosition.x}
          cy={indicatorPosition.y}
          r={INDICATOR_RADIUS}
          fill={STATUS_COLORS[status]}
          stroke="#000000"
          strokeWidth={1}
        />
      )}
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- PitchMeter`
Expected: PASS — 8 tests passed.

- [ ] **Step 5: Run the full suite**

Run: `cd frontend && npm test`
Expected: PASS — all tests across all files pass (unchanged files' tests are unaffected; `ExercisePlayer.tsx` was not touched and needs no test changes since `App.test.tsx` never mounts it, per the existing test-scope boundary).

- [ ] **Step 6: Manual visual check**

Run: `cd frontend && npm run dev`, open the app, click into any exercise, and confirm by eye:
- All 12 bubbles are visible, evenly spaced, readable (text contrast ok on every color).
- With mic access granted, the live indicator dot appears and moves smoothly as pitch changes, without jumping erratically between far-apart positions on small pitch changes.
- The exercise's current target bubble is visibly highlighted (thicker/white outline) and changes as the exercise progresses through its notes.

This is a visual/aesthetic check, not a strict pass/fail gate like the automated tests — note anything that looks visually broken (overlapping bubbles, unreadable text, indicator invisible against its background) so it can be adjusted, but don't block on subjective polish.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/PitchMeter.tsx frontend/src/components/PitchMeter.test.tsx
git commit -m "feat: replace pitch meter with a chromatic wheel display"
```

---

## Out of scope for this plan

- Any change to pitch detection, exercise data, the reference tone player, or the mic-tracking hook — all of that is reused unchanged.
- Smooth CSS/JS transition animation for the indicator (it updates at the same ~20Hz cadence as today, no easing) — a possible future polish item, not required now.
- Representing octave visually (a 12-position wheel is inherently octave-blind by design — see the spec's rationale). This means singing the right pitch class in the wrong octave will show the indicator on the correct bubble but colored as "off," which is an accepted, documented limitation, not a bug to fix here.
