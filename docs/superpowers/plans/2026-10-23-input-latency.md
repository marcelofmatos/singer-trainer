# Atraso por entrada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada faixa tem um atraso (ms), calibrável automaticamente e ajustável à mão, que corrige o instante de tudo o que ela detecta — no desenho (piano-roll e alvo das visualizações em tempo real) e na pontuação (exercício e "Entrada de áudio").

**Spec:** `docs/superpowers/specs/2026-10-23-input-latency-design.md` — leia o "Princípio" antes de qualquer task.

**Convenções:** comandos em `frontend/`; commits com a identidade configurada, **sem** `Co-Authored-By`; UI em português, código em inglês; TDD (teste falhando primeiro).

---

### Task 1: Regra pura da calibração e persistência do atraso

**Files:** `frontend/src/lib/latency.ts` (+test), `frontend/src/lib/inputLanes.ts` (+test)

- [ ] **Tests first**, then implement:
  - `latency.ts`:
    - `CALIBRATION_NOTES = [60, 67, 60, 67, 60, 67]`, `CALIBRATION_NOTE_MS = 350`, `CALIBRATION_GAP_MS = 150`, `MAX_LATENCY_MS = 1000`, `MIN_DETECTED = 3`, `DETECTION_WINDOW_MS = 1000`.
    - `clampLatency(ms)` → rounded to 10 ms, clamped to [0, 1000], non-finite → 0.
    - `estimateLatency(onsets: { time: number; midi: number }[], detections: { time: number; midi: number | null }[])` → for each onset, the first detection with the same pitch class (any octave) at `time ∈ [onset, onset + 1000]` gives `detection.time − onset.time`; returns `clampLatency(median)` when at least 3 onsets were matched, else `null`. Detections of other notes, `null` detections and detections before the onset are ignored.
    - Tests: median of matched delays (e.g. 170/190/180/200 → 190 → rounded), null with only 2 matches, other notes ignored, window limit, rounding and clamping.
  - `inputLanes.ts`: `InputLaneConfig.latencyMs?: number`; `isLane` accepts it when absent or a finite number in [0, 1000]; tests: round-trip with `latencyMs`, invalid value (e.g. 5000 or 'x') → the stored lanes are rejected as today for invalid entries? **No** — prefer leniency: load the lane but drop an invalid `latencyMs` (treat as 0). Test that.
- [ ] Gate: `npm test && npx tsc -b`. Commit `feat: add latency calibration rules and per-lane latency storage`.

---

### Task 2: Calibração e ajuste na faixa

**Files:** `frontend/src/audio/calibrationTone.ts` (new), `frontend/src/components/InputLane.tsx` (+test), `frontend/src/index.css`

- [ ] **`calibrationTone.ts`**: `playCalibrationSequence(context: AudioContext, now: () => number): number[]` schedules the `CALIBRATION_NOTES` (sine, short attack/release, moderate gain) with `CALIBRATION_NOTE_MS`/`CALIBRATION_GAP_MS` spacing starting ~100 ms ahead and returns each note's planned start time in the `now()` clock (map `context.currentTime` to `now()` at scheduling). Keep it small; test with a mock AudioContext that the right number of oscillators is scheduled and times are spaced 500 ms apart.
- [ ] **`InputLane`** (tests first, with the tracker mocked as in `InputLane.test.tsx`):
  - New props: `latencyMs: number`, `onLatencyChange: (laneId: string, ms: number) => void`, `onCalibrationStart?: () => void` (the player uses it to pause the exercise).
  - Header button ⏱ (`aria-label="Atraso da entrada"`, `aria-expanded`), text "⏱ 180 ms" when > 0 else "⏱". Toggles an absolutely positioned panel under the header (doesn't move the visualization) containing: range `aria-label="Atraso"` 0–1000 step 10 with the value "180 ms"; button "Calibrar"; a status line.
  - Calibrate: calls `onCalibrationStart`, creates an `AudioContext`, calls `playCalibrationSequence` with `Date.now`, collects this lane's detections (`{ time: Date.now(), midi }` from the tracker's note changes, null on silence) for the sequence duration + 1 s, then `estimateLatency`; success → `onLatencyChange(laneId, value)` and status "Atraso medido: 180 ms"; failure → "Não foi possível calibrar: a entrada não captou as notas de teste."; closes the AudioContext. Status "Calibrando…" while running; the button is disabled meanwhile.
  - Tests: ⏱ toggles the panel; slider calls `onLatencyChange`; calibration with `playCalibrationSequence` mocked (vi.mock) to return known onsets and the tracker mock emitting matching notes at +200 ms → callback with 200 and the success text; with no detections → failure text, no callback. Use fake timers.
  - CSS: `.lane-latency-panel` absolutely positioned (top: 100% of the header, full lane width, z-index above the view, elevated background, border, radius, padding), header gets `position: relative`.
- [ ] Gate + commit `feat: calibrate and fine-tune each input's latency`.

---

### Task 3: Compensação no desenho e na pontuação

**Files:** `frontend/src/components/PianoRollView.tsx`, `frontend/src/lib/pianoRoll.ts` (+tests), `frontend/src/components/InputLane.tsx`, `frontend/src/components/ExercisePlayer.tsx` (+tests), `README.md`

- [ ] **PianoRollView / pianoRoll.ts** (tests first): prop `latencyMs` (default 0) and `targetLatencyMs` (default 0). Keep voice and target as separate time series: each tick at real time `t` records the voice at `t − latencyMs` and the target at `t − targetLatencyMs`. Voice block status = `statusForPitch(voice, targetAt(voiceTime))` using the target series (nearest target sample at or before that time; `null` → nearest-note status). Range/blocks/bars use these corrected times. Test: with `latencyMs=200`, a voice equal to the target drawn 200 ms late in real time is drawn aligned with the target bar and green.
- [ ] **InputLane**: pass `latencyMs` to the piano-roll; new prop `targetLatencyMs` (reference mode: the reference lane's latency for non-reference lanes) forwarded too.
- [ ] **ExercisePlayer** (tests first, in the lanes/reference test files' style):
  1. Persist `latencyMs` changes into the lane config (`onLatencyChange`); `onCalibrationStart` pauses playback.
  2. **Exercise mode target per lane**: `noteAtTime(scaledExercise, elapsed − L/1000)` for that lane (wheel/keyboard/tuner/piano-roll and sampling all use it).
  3. **Scoring with a delay**: replace immediate hit evaluation by a per-lane queue: `handleSample(laneId, detected)` enqueues `{ time: Date.now() − L_lane, detected }`; a 100 ms evaluator processes entries whose corrected time ≤ `now − L_target` (exercise: `L_target = 0`; reference: `L_ref`): exercise → target at that corrected time from a target history (record `{ time: Date.now(), midi }` on each elapsed poll; lookup = last entry at or before the time) and `isHit`; reference → `matchesReference(detected, referenceHistory, correctedTime, 500)` where reference samples are stored with `time = Date.now() − L_ref`. Entries without a target at their time are dropped (no target time counted). Free mode: evaluate immediately as today (no target). Pass completion/recording must flush the queue first (evaluate what can be evaluated; drop the rest).
  4. Tests: exercise lane with L=200 singing the target 200 ms late scores ≈ 100% (and the same timing with L=0 scores clearly less); reference mode with `L_ref=200` and a mic aligned to the corrected reference scores; calibration start pauses; latency persisted in `singer-trainer:input-lanes`.
- [ ] **README**: bullet "**Atraso por entrada** — botão ⏱ em cada faixa: calibre automaticamente (o app toca notas de teste e mede o atraso, ideal para o "Monitor of …") ou ajuste à mão; o atraso é compensado no piano-roll e na pontuação."
- [ ] Verify `npm test && npx tsc -b && npm run build`; Playwright check (Vite on 5179): open ⏱ on a lane, screenshot `.playwright-mcp/latency-panel.png`; stop Vite by the PID on 5179.
- [ ] Commit `feat: compensate each input's latency in the piano-roll and scoring`.
