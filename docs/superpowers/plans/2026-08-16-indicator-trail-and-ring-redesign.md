# Indicator Trail and Ring Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the chromatic wheel's live pitch indicator from a solid filled dot into a hollow, status-colored ring with a fading "ghost trail" behind it, so it stops covering the note bubble it slides over and feels less mechanically rigid.

**Architecture:** A new pure module (`indicatorTrail.ts`) provides the array-advancing logic (append-and-cap, or age-out-one) that both grows the trail while singing and fades it out during silence. `PitchMeter` runs its own internal `setInterval` clock (matching the pitch tracker's 50ms cadence) to drive this, independent of React's render cycle — this is what lets the trail keep aging out smoothly during silence without getting stuck or risking a render loop.

**Tech Stack:** React + TypeScript, Vitest (`vi.useFakeTimers()`) + @testing-library/react.

Full design rationale: [`docs/superpowers/specs/2026-08-16-indicator-trail-and-ring-redesign.md`](../specs/2026-08-16-indicator-trail-and-ring-redesign.md).

---

### Task 1: `indicatorTrail.ts` — pure trail-advancing helper

**Files:**
- Create: `frontend/src/lib/indicatorTrail.ts`
- Test: Create `frontend/src/lib/indicatorTrail.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/indicatorTrail.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { advanceTrail } from './indicatorTrail';

describe('advanceTrail', () => {
  it('appends a new value to the end of the trail', () => {
    expect(advanceTrail([1, 2, 3], 4, 10)).toEqual([1, 2, 3, 4]);
  });

  it('caps the trail at maxLength, dropping the oldest values first', () => {
    expect(advanceTrail([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });

  it('drops the oldest value when there is no new one, to age the trail out', () => {
    expect(advanceTrail([1, 2, 3], null, 3)).toEqual([2, 3]);
  });

  it('returns the same array reference when already empty and there is no new value', () => {
    const empty: number[] = [];
    expect(advanceTrail(empty, null, 3)).toBe(empty);
  });

  it('starts a trail from empty when a new value arrives', () => {
    expect(advanceTrail([], 1, 3)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — every test in `indicatorTrail.test.ts` fails because `frontend/src/lib/indicatorTrail.ts` doesn't exist yet (module not found). All other test files still PASS (102 tests across 12 files at baseline).

- [ ] **Step 3: Implement the minimal module**

Create `frontend/src/lib/indicatorTrail.ts` with:

```ts
/**
 * Advances a fixed-length trail of recent values by one tick: appends `next` and caps
 * the trail at `maxLength` when there's a new value, or drops the oldest entry when
 * there isn't (letting an existing trail fade out gracefully instead of vanishing) —
 * returns the same array reference when there's nothing left to age out, so callers
 * relying on reference equality (e.g. React state) can bail out of re-rendering.
 */
export function advanceTrail<T>(prev: T[], next: T | null, maxLength: number): T[] {
  if (next !== null) {
    return [...prev, next].slice(-maxLength);
  }
  if (prev.length === 0) return prev;
  return prev.slice(1);
}
```

- [ ] **Step 4: Run tests to verify they all pass**

Run: `cd frontend && npm test`
Expected: PASS — all 5 tests in `indicatorTrail.test.ts`, and the full suite (107 tests across 13 files: 102 baseline + 5 new).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/indicatorTrail.ts frontend/src/lib/indicatorTrail.test.ts
git commit -m "feat: add pure trail-advancing helper for the pitch indicator"
```

---

### Task 2: `PitchMeter` — hollow-ring trail redesign

**Files:**
- Modify: `frontend/src/components/PitchMeter.tsx`
- Modify: `frontend/src/components/PitchMeter.test.tsx`

- [ ] **Step 1: Write the failing/updated tests**

Overwrite `frontend/src/components/PitchMeter.test.tsx` with:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PitchMeter } from './PitchMeter';

const TRAIL_TICK_MS = 50;

describe('PitchMeter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all 12 chromatic note bubbles', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((name) => {
      expect(screen.getByTestId(`note-bubble-${name}`)).toBeDefined();
    });
  });

  it('shows no live indicator when no note is detected', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.queryByTestId('live-indicator')).toBeNull();
  });

  it('shows the live indicator once a note is detected', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.getByTestId('live-indicator')).toBeDefined();
  });

  it('marks the target note bubble as active and leaves others inactive', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
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
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('in-tune');
  });

  it('labels the indicator as off when far from the target', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 40 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('off');
  });

  it('accounts for whole-semitone offsets from the target, not just cents', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'G', octave: 4, midiNumber: 67, cents: 0 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('off');
  });

  it('falls back to nearest-chromatic-note tuning when no exercise target is active', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: -15 }}
        targetMidiNumber={null}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.getByTestId('live-indicator').dataset.status).toBe('close');
    expect(screen.getByTestId('note-bubble-A').dataset.active).toBe('false');
  });

  it('calls onNoteClick with the pitch class index when a bubble is clicked', () => {
    const handleClick = vi.fn();
    render(
      <PitchMeter
        detectedNote={null}
        targetMidiNumber={null}
        micDisconnected={false}
        onNoteClick={handleClick}
      />
    );
    fireEvent.click(screen.getByTestId('note-bubble-D'));
    expect(handleClick).toHaveBeenCalledWith(2);
  });

  it('calls onNoteClick when a bubble is activated via keyboard (Enter)', () => {
    const handleClick = vi.fn();
    render(
      <PitchMeter
        detectedNote={null}
        targetMidiNumber={null}
        micDisconnected={false}
        onNoteClick={handleClick}
      />
    );
    fireEvent.keyDown(screen.getByTestId('note-bubble-A'), { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledWith(9);
  });

  it('does not throw when a bubble is clicked without an onNoteClick handler', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    expect(() => fireEvent.click(screen.getByTestId('note-bubble-C'))).not.toThrow();
  });

  it('shows the sung note and octave in the center, colored by tuning status', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    const label = screen.getByTestId('center-note-label');
    expect(label.textContent).toBe('A4');
    expect(label.getAttribute('fill')).toBe('#2ecc71');
  });

  it('shows the mic-disconnected icon instead of the note label when the mic is disconnected', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={true}
      />
    );
    expect(screen.getByTestId('mic-disconnected-icon').textContent).toBe('🎤🚫');
    expect(screen.queryByTestId('center-note-label')).toBeNull();
  });

  it('shows nothing in the center when there is no detected note and the mic is connected', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.queryByTestId('center-note-label')).toBeNull();
    expect(screen.queryByTestId('mic-disconnected-icon')).toBeNull();
  });

  it('grows a fading trail behind the live indicator as ticks pass', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS * 3);
    });
    expect(screen.getAllByTestId('live-indicator-trail').length).toBe(2);
    expect(screen.getByTestId('live-indicator')).toBeDefined();
  });

  it('caps the trail at 6 points even after many ticks', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS * 10);
    });
    expect(screen.getAllByTestId('live-indicator-trail').length).toBe(5);
  });

  it('fades the trail out one point per tick after the note stops, instead of vanishing instantly', () => {
    const { rerender } = render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS * 6);
    });
    expect(screen.getAllByTestId('live-indicator-trail').length).toBe(5);

    rerender(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS);
    });
    expect(screen.getAllByTestId('live-indicator-trail').length).toBe(4);
    expect(screen.getByTestId('live-indicator')).toBeDefined();
  });

  it('fully empties the trail after enough silent ticks', () => {
    const { rerender } = render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS * 6);
    });

    rerender(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(TRAIL_TICK_MS * 6);
    });
    expect(screen.queryByTestId('live-indicator')).toBeNull();
    expect(screen.queryAllByTestId('live-indicator-trail').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail and the touched old ones fail (need fake-timer advancement)**

Run: `cd frontend && npm test`
Expected: FAIL — the 4 new trail tests fail (`getAllByTestId('live-indicator-trail')` finds nothing, since `PitchMeter.tsx` doesn't render any trail yet), and every existing test that checks `live-indicator` also fails (the component doesn't yet wait for a tick before showing anything — actually since the *old* component code is still in place at this point, those tests may still incidentally pass because the old code renders the indicator synchronously from props, with no timer involved; the `act(() => vi.advanceTimersByTime(...))` calls are harmless no-ops against the old code). The important thing to confirm: the 4 new trail-specific tests fail with "Unable to find an element by: [data-testid=\"live-indicator-trail\"]". Tests unrelated to the indicator (bubbles, clicks, center label, mic icon) still PASS.

- [ ] **Step 3: Implement the minimal component change**

Overwrite `frontend/src/components/PitchMeter.tsx` with:

```tsx
// frontend/src/components/PitchMeter.tsx
import { useEffect, useRef, useState } from 'react';
import {
  CHROMATIC_NOTE_COLORS,
  CHROMATIC_NOTE_NAMES,
  DEGREES_PER_SEMITONE,
  angleForPitch,
  pitchClassIndex,
  pointOnCircle,
  readableTextColor,
} from '../lib/chromaticWheel';
import { advanceTrail } from '../lib/indicatorTrail';
import { STATUS_COLORS, statusForNote, type TuningStatus } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';

export interface PitchMeterProps {
  detectedNote: NoteInfo | null;
  /** The exercise's current target note, if one is playing. */
  targetMidiNumber: number | null;
  /** True when the microphone stream failed or permission was denied. */
  micDisconnected: boolean;
  /** Called with the pitch class index (0=C .. 11=B) when a bubble is clicked or activated via keyboard. */
  onNoteClick?: (pitchClassIndex: number) => void;
}

interface TrailPoint {
  id: number;
  x: number;
  y: number;
  status: TuningStatus;
}

const VIEWBOX_SIZE = 240;
const CENTER = { x: VIEWBOX_SIZE / 2, y: VIEWBOX_SIZE / 2 };
const WHEEL_RADIUS = 90;
const BUBBLE_RADIUS = 22;
const RING_RADIUS = 20;
const RING_STROKE_WIDTH = 5;
const TRAIL_LENGTH = 6; // ~300ms tail at TRAIL_TICK_MS
const TRAIL_TICK_MS = 50; // matches the pitch tracker's own detection cadence

export function PitchMeter({
  detectedNote,
  targetMidiNumber,
  micDisconnected,
  onNoteClick,
}: PitchMeterProps) {
  const targetPitchClass = targetMidiNumber !== null ? pitchClassIndex(targetMidiNumber) : null;

  const status = statusForNote(detectedNote, targetMidiNumber);

  // The indicator's position is always the *absolute* sung pitch (its own pitch class
  // plus its own cents) — this is what makes it slide continuously around the wheel.
  const indicatorPosition = detectedNote
    ? pointOnCircle(angleForPitch(detectedNote.midiNumber, detectedNote.cents), WHEEL_RADIUS, CENTER)
    : null;

  // Kept in sync with the latest render's computed position/status, read from inside
  // the trail's own tick interval below (not from React's render cycle directly) —
  // this is what lets the trail keep aging out smoothly during silence instead of
  // getting stuck partway or risking a render loop tied to prop changes.
  const currentPositionRef = useRef<{ x: number; y: number; status: TuningStatus } | null>(null);
  useEffect(() => {
    currentPositionRef.current =
      indicatorPosition && status ? { x: indicatorPosition.x, y: indicatorPosition.y, status } : null;
  });

  const nextTrailIdRef = useRef(0);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  useEffect(() => {
    const intervalId = setInterval(() => {
      const current = currentPositionRef.current;
      const point: TrailPoint | null = current ? { id: nextTrailIdRef.current++, ...current } : null;
      setTrail((prev) => advanceTrail(prev, point, TRAIL_LENGTH));
    }, TRAIL_TICK_MS);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} width="100%" role="img" aria-label="Roda cromática de afinação">
      {CHROMATIC_NOTE_NAMES.map((name, index) => {
        const { x, y } = pointOnCircle(index * DEGREES_PER_SEMITONE, WHEEL_RADIUS, CENTER);
        const isTarget = targetPitchClass === index;
        const color = CHROMATIC_NOTE_COLORS[index];
        return (
          <g
            key={name}
            data-testid={`note-bubble-${name}`}
            data-active={isTarget ? 'true' : 'false'}
            role={onNoteClick ? 'button' : undefined}
            tabIndex={onNoteClick ? 0 : undefined}
            style={onNoteClick ? { cursor: 'pointer' } : undefined}
            onClick={onNoteClick ? () => onNoteClick(index) : undefined}
            onKeyDown={
              onNoteClick
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onNoteClick(index);
                    }
                  }
                : undefined
            }
          >
            {isTarget && (
              <>
                <circle cx={x} cy={y} r={BUBBLE_RADIUS + 6} fill="none" stroke="#ffffff" strokeWidth={2} />
                <circle cx={x} cy={y} r={BUBBLE_RADIUS + 4} fill="none" stroke="#000000" strokeWidth={2} />
              </>
            )}
            <circle cx={x} cy={y} r={BUBBLE_RADIUS} fill={color} />
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
      {trail.map((point, index) => (
        <circle
          key={point.id}
          data-testid={index === trail.length - 1 ? 'live-indicator' : 'live-indicator-trail'}
          data-status={point.status}
          cx={point.x}
          cy={point.y}
          r={RING_RADIUS}
          fill="none"
          stroke={STATUS_COLORS[point.status]}
          strokeWidth={RING_STROKE_WIDTH}
          opacity={(index + 1) / trail.length}
        />
      ))}
      {micDisconnected ? (
        <text
          data-testid="mic-disconnected-icon"
          x={CENTER.x}
          y={CENTER.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="32"
          aria-hidden="true"
        >
          🎤🚫
        </text>
      ) : (
        detectedNote &&
        status && (
          <text
            data-testid="center-note-label"
            x={CENTER.x}
            y={CENTER.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-display)"
            fontSize="28"
            fontWeight={600}
            fill={STATUS_COLORS[status]}
            aria-hidden="true"
          >
            {detectedNote.noteName}
            {detectedNote.octave}
          </text>
        )
      )}
    </svg>
  );
}
```

- [ ] **Step 4: Run tests to verify they all pass**

Run: `cd frontend && npm test`
Expected: PASS — all 18 tests in `PitchMeter.test.tsx` (14 pre-existing + 4 new), and the full suite (111 tests across 13 files: 107 from after Task 1 + 4 new).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PitchMeter.tsx frontend/src/components/PitchMeter.test.tsx
git commit -m "feat: redesign the live indicator as a hollow ring with a fading trail"
```

---

### Task 3: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && npm run dev` (background/long-running — leave it running, note the printed local URL, typically `http://localhost:5173`).

- [ ] **Step 2: Load the app and check the golden path**

Open the printed URL in a browser. Grant microphone permission when prompted. Sing or hum a steady, then varying, note. Confirm:
- The indicator on the wheel is now a hollow colored ring (no solid fill, no white/black contour), sized close to the note bubbles.
- When the ring is near/over a bubble, the bubble's letter is still readable through the ring's transparent middle.
- As you sing, a short fading trail of 5-6 rings follows behind the current position, most recent closest to full opacity, oldest nearly invisible.
- When you stop singing (go silent), the trail doesn't vanish instantly — it shrinks away over roughly half a second.

- [ ] **Step 3: Report results honestly**

If browser automation isn't available in the environment used for this check (e.g., the Chrome extension isn't connected), use the Playwright MCP tools instead (available in this environment — used successfully for a prior fix in this same project) to at least verify the rendered SVG structure and ring/opacity values in a real browser, and say plainly what was and wasn't checked with a real microphone.

- [ ] **Step 4: Stop the dev server**

Stop the `npm run dev` process started in Step 1.
