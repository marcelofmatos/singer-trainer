# Center Note Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the currently sung note (name + octave, colored by tuning status) in the center of the chromatic wheel, and a disconnected-mic icon there instead when the microphone stream has failed.

**Architecture:** `PitchMeter` (the SVG chromatic wheel component) gains a new required `micDisconnected: boolean` prop and renders one more conditional `<text>` element at the wheel's center — no new files, no new dependencies. `ExercisePlayer` (the only caller) passes `micDisconnected={pitchTracker.status === 'error'}`, derived from state it already reads.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react, plain SVG (no `foreignObject`).

Full design rationale: [`docs/superpowers/specs/2026-08-10-center-note-display-design.md`](../specs/2026-08-10-center-note-display-design.md).

---

### Task 1: `PitchMeter` — center note label and mic-disconnected icon

**Files:**
- Modify: `frontend/src/components/PitchMeter.tsx`
- Test: `frontend/src/components/PitchMeter.test.tsx`

- [ ] **Step 1: Write the new failing tests, and update existing render calls for the new required prop**

Overwrite `frontend/src/components/PitchMeter.test.tsx` with:

```tsx
// frontend/src/components/PitchMeter.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PitchMeter } from './PitchMeter';

describe('PitchMeter', () => {
  it('renders all 12 chromatic note bubbles', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((name) => {
      expect(screen.getByTestId(`note-bubble-${name}`)).toBeDefined();
    });
  });

  it('shows no live indicator when no note is detected', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
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
});
```

- [ ] **Step 2: Run tests to verify the 3 new tests fail, and the rest still pass**

Run: `cd frontend && npm test`
Expected: 3 failures — `shows the sung note and octave in the center, colored by tuning status`, `shows the mic-disconnected icon instead of the note label when the mic is disconnected`, and `shows nothing in the center when there is no detected note and the mic is connected` — each failing with something like `Unable to find an element by: [data-testid="center-note-label"]` (or `mic-disconnected-icon`). The other 9 pre-existing tests still PASS (the extra `micDisconnected` prop is inert until Step 3, since it isn't part of `PitchMeterProps` yet and the component doesn't read it).

- [ ] **Step 3: Implement the minimal component change**

Overwrite `frontend/src/components/PitchMeter.tsx` with:

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
  /** True when the microphone stream failed or permission was denied. */
  micDisconnected: boolean;
  /** Called with the pitch class index (0=C .. 11=B) when a bubble is clicked or activated via keyboard. */
  onNoteClick?: (pitchClassIndex: number) => void;
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

export function PitchMeter({
  detectedNote,
  targetMidiNumber,
  micDisconnected,
  onNoteClick,
}: PitchMeterProps) {
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
      {indicatorPosition && status && (
        <g data-testid="live-indicator" data-status={status}>
          <circle
            cx={indicatorPosition.x}
            cy={indicatorPosition.y}
            r={INDICATOR_RADIUS + 4}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
          />
          <circle
            cx={indicatorPosition.x}
            cy={indicatorPosition.y}
            r={INDICATOR_RADIUS + 2}
            fill="none"
            stroke="#000000"
            strokeWidth={2}
          />
          <circle
            cx={indicatorPosition.x}
            cy={indicatorPosition.y}
            r={INDICATOR_RADIUS}
            fill={STATUS_COLORS[status]}
          />
        </g>
      )}
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
Expected: PASS — all 14 tests in `PitchMeter.test.tsx` (11 pre-existing + 3 new).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors. (This is the step that actually verifies `micDisconnected` is required-and-satisfied consistently — `npm test` alone doesn't type-check.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PitchMeter.tsx frontend/src/components/PitchMeter.test.tsx
git commit -m "feat: show the sung note and a mic-disconnected icon in the wheel's center"
```

---

### Task 2: Wire `ExercisePlayer` to pass `micDisconnected`

**Files:**
- Modify: `frontend/src/components/ExercisePlayer.tsx:158-164`

- [ ] **Step 1: Pass the new prop from the existing mic tracker state**

In `frontend/src/components/ExercisePlayer.tsx`, find:

```tsx
      <div className="wheel-stage">
        <PitchMeter
          detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
          targetMidiNumber={targetNote?.midiNumber ?? null}
          onNoteClick={handleNoteClick}
        />
      </div>
```

Replace with:

```tsx
      <div className="wheel-stage">
        <PitchMeter
          detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
          targetMidiNumber={targetNote?.midiNumber ?? null}
          micDisconnected={pitchTracker.status === 'error'}
          onNoteClick={handleNoteClick}
        />
      </div>
```

- [ ] **Step 2: Run the full test suite**

Run: `cd frontend && npm test`
Expected: PASS — all suites, including `App.test.tsx` (which renders the full app through `ExercisePlayer`).

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ExercisePlayer.tsx
git commit -m "feat: wire mic-disconnected state into the chromatic wheel"
```

---

### Task 3: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && npm run dev` (background/long-running — leave it running, note the printed local URL, typically `http://localhost:5173`).

- [ ] **Step 2: Load the app and check the golden path**

Open the printed URL in a browser. Grant microphone permission when prompted. Sing or hum a steady note near a piano/tuner reference. Confirm:
- The center of the wheel shows text like `"A4"` (note name + octave) while a pitch is being detected.
- That text's color changes between green/yellow/red as you move closer to/further from the nearest chromatic note (matches the ring indicator's color).
- The center goes empty during silence (no note detected) while the mic is still listening.

- [ ] **Step 3: Check the disconnected-mic path**

Reload the page and deny the microphone permission prompt (or revoke mic permission for the site beforehand, then reload). Confirm:
- The center of the wheel shows the `🎤🚫` icon.
- The existing error text above the wheel ("Erro ao acessar o microfone: …") still appears as before — this step should show that text is unchanged, only the center icon is new.

- [ ] **Step 4: Report results honestly**

If mic permission automation isn't available in the environment used for this check (e.g., a headless/browser-automation tool that can't grant real mic access), say so explicitly rather than claiming the golden path was verified — confirm what *was* checked (e.g., the disconnected/error path, or a static render) and flag what still needs a manual check by the user in a real browser with a real microphone.

- [ ] **Step 5: Stop the dev server**

Stop the `npm run dev` process started in Step 1.
