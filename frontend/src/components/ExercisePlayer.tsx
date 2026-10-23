// frontend/src/components/ExercisePlayer.tsx
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Exercise } from '../lib/exercises';
import { exerciseDuration, noteAtTime, scaleExerciseTiming } from '../lib/exerciseTiming';
import { loadPlaybackPreferences, savePlaybackPreferences } from '../lib/playbackPreferences';
import { playExerciseTone, REFERENCE_TONE_GAIN } from '../audio/referenceTone';
import { playPreviewTone } from '../audio/previewTone';
import { useAudioInputs } from '../hooks/useAudioInputs';
import {
  createLaneId,
  findRealInput,
  loadInputLanes,
  nextFreeDeviceId,
  PRIMARY_LANE_ID,
  saveInputLanes,
  type InputLaneConfig,
} from '../lib/inputLanes';
import { resolveShortcut, stepWithin, type ShortcutAction } from '../lib/keyboardShortcuts';
import type { NoteInfo } from '../lib/noteUtils';
import {
  defaultReferenceLaneId,
  loadReferenceLaneId,
  matchesReference,
  pushReferenceSample,
  REFERENCE_TOLERANCE_MS,
  saveReferenceLaneId,
  type ReferenceSample,
} from '../lib/referenceMatch';
import { addSample, addTallies, EMPTY_TALLY, isHit, type ScoreTally } from '../lib/scoring';
import { appendScoreRecord, loadScoreHistory, totalTallyForInput } from '../lib/scoreHistory';
import {
  loadVisualization,
  nextVisualization,
  saveVisualization,
  VISUALIZATION_MODES,
  type VisualizationMode,
} from '../lib/visualization';
import { InputLane } from './InputLane';
import { KeyboardHelp } from './KeyboardHelp';
import { type NoteNavigatorHandle } from './PitchMeter';
import { ScoreBoard } from './ScoreBoard';
import { ScoreHistory } from './ScoreHistory';

export interface ExercisePlayerProps {
  exercise: Exercise;
  onPreviousExercise: () => void;
  onNextExercise: () => void;
  exerciseSelect: ReactNode;
}

const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2;
const PLAYBACK_RATE_STEP = 0.25;
const MIN_SENSITIVITY = 0.05;
const MAX_SENSITIVITY = 0.35;
const SENSITIVITY_STEP = 0.05;
// Only navigation and stepping make sense while a key is held; toggles would flicker.
const REPEATABLE_ACTIONS: ShortcutAction[] = [
  'nextNote',
  'previousNote',
  'slower',
  'faster',
  'lessSensitive',
  'moreSensitive',
];
const PREVIEW_CONTEXT_LIFETIME_MS = 600;
// Seconds each lane sample stands for; must match InputLane's 100ms scoring tick.
const SAMPLE_SECONDS = 0.1;

export function ExercisePlayer({
  exercise,
  onPreviousExercise,
  onNextExercise,
  exerciseSelect,
}: ExercisePlayerProps) {
  // The reference mode has no tone or clock: another input's live notes are the target.
  const isReferenceMode = exercise.mode === 'reference';
  const [elapsed, setElapsed] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(() => loadPlaybackPreferences().playbackRate);
  const [loop, setLoop] = useState(() => loadPlaybackPreferences().loop);
  const [micSensitivity, setMicSensitivity] = useState(
    () => loadPlaybackPreferences().micSensitivity
  );
  const [playing, setPlaying] = useState(true);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lanes, setLanes] = useState<InputLaneConfig[]>(() => loadInputLanes());
  const [micOff, setMicOff] = useState<Record<string, boolean>>({});
  // The device each lane's tracker actually opened (the primary lane on the system default has deviceId null).
  const [devicesInUse, setDevicesInUse] = useState<
    Record<string, { deviceId: string | null; groupId: string | null }>
  >({});
  const [passTallies, setPassTallies] = useState<Record<string, ScoreTally>>({});
  // Mirrors passTallies synchronously: a lane may sample in the same tick the pass ends, before
  // a re-render, and that sample must still be counted in the pass being completed.
  const passTalliesRef = useRef<Record<string, ScoreTally>>({});
  const [sessionTallies, setSessionTallies] = useState<Record<string, ScoreTally>>({});
  const [history, setHistory] = useState(() => loadScoreHistory());
  const [cycle, setCycle] = useState(0);
  const [toneError, setToneError] = useState<string | null>(null);
  const [visualization, setVisualization] = useState(() => loadVisualization());
  const [referenceLaneId, setReferenceLaneId] = useState(() => loadReferenceLaneId());
  // The reference's current semitone; only changes when the semitone does, so cents jitter doesn't re-render.
  const [referenceTarget, setReferenceTarget] = useState<number | null>(null);
  // Notes the reference held until recently, so a late singer still hits within the tolerance.
  const referenceHistoryRef = useRef<ReferenceSample[]>([]);
  // The note each lane hears right now, as last reported by the lane.
  const latestNotesRef = useRef<Record<string, NoteInfo | null>>({});
  const audioInputs = useAudioInputs(null);

  useEffect(() => saveInputLanes(lanes), [lanes]);
  useEffect(() => saveVisualization(visualization), [visualization]);

  // Read via refs inside the effect below so toggling these controls mid-playback
  // doesn't restart the currently-playing cycle from scratch.
  const loopRef = useRef(loop);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const completePassRef = useRef(() => {});
  const audioContextRef = useRef<AudioContext | null>(null);
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
    const audioContext = audioContextRef.current;
    if (!audioContext) return;
    if (playing) {
      audioContext.resume().catch((err) => console.error('Failed to change audio playback state:', err));
    } else {
      audioContext.suspend().catch((err) => console.error('Failed to change audio playback state:', err));
    }
  }, [playing]);

  const gainRef = useRef<GainNode | null>(null);
  const mutedRef = useRef(muted);
  const wheelRef = useRef<NoteNavigatorHandle>(null);
  useEffect(() => {
    mutedRef.current = muted;
    const gain = gainRef.current;
    if (!gain) return;
    gain.gain.value = muted ? 0 : REFERENCE_TONE_GAIN;
  }, [muted]);

  useEffect(() => {
    savePlaybackPreferences({ playbackRate, loop, micSensitivity });
  }, [playbackRate, loop, micSensitivity]);

  // The speed has no effect in reference mode; keeping it out stops it from resetting the running pass.
  const timingRate = isReferenceMode ? 1 : playbackRate;
  const scaledExercise = useMemo(
    () => scaleExerciseTiming(exercise, timingRate),
    [exercise, timingRate]
  );

  useEffect(() => {
    if (isReferenceMode) {
      // An empty exercise would "end" on the first poll, so there is no tone or clock at all.
      setToneError(null);
      setElapsed(0);
      setEnded(false);
      passTalliesRef.current = {};
      setPassTallies({});
      return;
    }

    let audioContext: AudioContext | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let hasEnded = false;

    try {
      audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      if (!playingRef.current) {
        audioContext.suspend().catch((err) => console.error('Failed to change audio playback state:', err));
      }

      const { gain } = playExerciseTone(audioContext, scaledExercise);
      gainRef.current = gain;
      if (mutedRef.current) {
        gain.gain.value = 0;
      }
      setToneError(null);
      setElapsed(0);
      setEnded(false);
      passTalliesRef.current = {};
      setPassTallies({});

      pollTimer = setInterval(() => {
        if (!audioContext) return;
        const currentTime = audioContext.currentTime;
        setElapsed(currentTime);
        if (!hasEnded && currentTime >= exerciseDuration(scaledExercise)) {
          hasEnded = true;
          completePassRef.current();
          if (loopRef.current) {
            setCycle((c) => c + 1);
          } else {
            if (pollTimer) clearInterval(pollTimer);
            setEnded(true);
            setPlaying(false);
          }
        }
      }, 100);
    } catch (err) {
      setToneError(
        err instanceof Error ? err.message : 'Não foi possível reproduzir o áudio de referência.'
      );
    }

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      audioContext?.close();
      audioContextRef.current = null;
      gainRef.current = null;
    };
  }, [scaledExercise, cycle, isReferenceMode]);

  const targetNote = noteAtTime(scaledExercise, elapsed);

  // A lane on the system default (or an alias like "default") is named after the real device it opened.
  function laneLabel(lane: InputLaneConfig, position: number): string {
    const inputs = audioInputs.inputs;
    const inUse = devicesInUse[lane.id];
    const device =
      findRealInput(inputs, lane.deviceId, null) ??
      findRealInput(inputs, inUse?.deviceId ?? null, inUse?.groupId ?? null) ??
      inputs.find((input) => input.deviceId === lane.deviceId);
    return device?.label ?? (lane.id === PRIMARY_LANE_ID ? 'Microfone' : `Entrada ${position}`);
  }

  function laneLabelById(laneId: string): string {
    const index = lanes.findIndex((lane) => lane.id === laneId);
    return laneLabel(lanes[index], index + 1);
  }

  const effectiveReferenceId = !isReferenceMode
    ? null
    : lanes.some((lane) => lane.id === referenceLaneId && lane.id !== PRIMARY_LANE_ID)
      ? referenceLaneId
      : defaultReferenceLaneId(
          lanes.map((lane) => lane.id),
          laneLabelById
        );

  // Synced before the lanes' (passive) effects run, so their reports and samples see this render's values.
  const referenceIdRef = useRef(effectiveReferenceId);
  const exerciseTargetRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    referenceIdRef.current = effectiveReferenceId;
    exerciseTargetRef.current = targetNote?.midiNumber ?? null;
  });

  // A new reference starts from what it hears now, without the previous reference's notes.
  useLayoutEffect(() => {
    referenceHistoryRef.current = [];
    const note = effectiveReferenceId ? latestNotesRef.current[effectiveReferenceId] ?? null : null;
    setReferenceTarget(note ? note.midiNumber : null);
  }, [effectiveReferenceId]);

  const handleNote = useCallback((laneId: string, note: NoteInfo | null) => {
    const previous = latestNotesRef.current[laneId] ?? null;
    latestNotesRef.current = { ...latestNotesRef.current, [laneId]: note };
    if (laneId !== referenceIdRef.current) return;
    // The note just left still counts for the tolerance window from now on.
    if (previous) {
      referenceHistoryRef.current = pushReferenceSample(
        referenceHistoryRef.current,
        { time: Date.now(), midi: previous.midiNumber, cents: previous.cents },
        REFERENCE_TOLERANCE_MS
      );
    }
    setReferenceTarget(note ? note.midiNumber : null);
  }, []);

  function addLane() {
    const inUse = Object.values(devicesInUse);
    const inUseDeviceIds = inUse.flatMap(({ deviceId }) => (deviceId ? [deviceId] : []));
    const inUseGroupIds = inUse.flatMap(({ groupId }) => (groupId ? [groupId] : []));
    setLanes((current) => [
      ...current,
      { id: createLaneId(), deviceId: nextFreeDeviceId(current, audioInputs.inputs, inUseDeviceIds, inUseGroupIds) },
    ]);
  }

  function withoutLane<T>(record: Record<string, T>, laneId: string): Record<string, T> {
    const next = { ...record };
    delete next[laneId];
    return next;
  }

  function removeLane(laneId: string) {
    setLanes((current) => current.filter((lane) => lane.id !== laneId));
    setDevicesInUse((current) => withoutLane(current, laneId));
    // Its unfinished pass goes too, so it can't leak into the session totals.
    passTalliesRef.current = withoutLane(passTalliesRef.current, laneId);
    setPassTallies(passTalliesRef.current);
  }

  const handleDeviceInUse = useCallback((laneId: string, deviceId: string | null, groupId: string | null) => {
    setDevicesInUse((current) =>
      current[laneId]?.deviceId === deviceId && current[laneId]?.groupId === groupId
        ? current
        : { ...current, [laneId]: { deviceId, groupId } }
    );
  }, []);

  function selectLaneDevice(laneId: string, deviceId: string) {
    setLanes((current) => current.map((lane) => (lane.id === laneId ? { ...lane, deviceId } : lane)));
  }

  function toggleLaneMic(laneId: string) {
    setMicOff((current) => ({ ...current, [laneId]: !current[laneId] }));
  }

  const handleSample = useCallback((laneId: string, detected: NoteInfo | null) => {
    let hit: boolean;
    if (referenceIdRef.current === null) {
      hit = isHit(detected, exerciseTargetRef.current);
    } else {
      const now = Date.now();
      const held = latestNotesRef.current[referenceIdRef.current] ?? null;
      const history = held
        ? [...referenceHistoryRef.current, { time: now, midi: held.midiNumber, cents: held.cents }]
        : referenceHistoryRef.current;
      hit = matchesReference(detected, history, now, REFERENCE_TOLERANCE_MS);
    }
    const current = passTalliesRef.current;
    passTalliesRef.current = { ...current, [laneId]: addSample(current[laneId] ?? EMPTY_TALLY, SAMPLE_SECONDS, hit) };
    setPassTallies(passTalliesRef.current);
  }, []);

  // Called when a pass ends (the playback poll; in reference mode pausing, leaving or hiding the
  // page): each lane's pass moves into its session and the stored history (and leaves the live
  // pass tallies, so nothing is counted twice). The reference lane is never recorded.
  useEffect(() => {
    completePassRef.current = () => {
      const tallies = { ...passTalliesRef.current };
      if (effectiveReferenceId) delete tallies[effectiveReferenceId];
      let latest = history;
      lanes.forEach((lane, index) => {
        const tally = tallies[lane.id];
        if (!tally || tally.targetSeconds === 0) return;
        latest = appendScoreRecord({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          finishedAt: Date.now(),
          playbackRate,
          inputId: lane.id,
          inputLabel: laneLabel(lane, index + 1),
          ...tally,
        });
      });
      setHistory(latest);
      setSessionTallies((current) => {
        const next = { ...current };
        for (const [laneId, tally] of Object.entries(tallies)) {
          next[laneId] = addTallies(next[laneId] ?? EMPTY_TALLY, tally);
        }
        return next;
      });
      passTalliesRef.current = {};
      setPassTallies({});
    };
  });

  useEffect(() => {
    if (!isReferenceMode) return;
    const recordPass = () => completePassRef.current();
    const recordIfHidden = () => {
      if (document.visibilityState === 'hidden') recordPass();
    };
    document.addEventListener('visibilitychange', recordIfHidden);
    window.addEventListener('pagehide', recordPass);
    return () => {
      document.removeEventListener('visibilitychange', recordIfHidden);
      window.removeEventListener('pagehide', recordPass);
      // Leaving the exercise (or the page) ends the running pass; this still sees the old closure.
      recordPass();
    };
  }, [isReferenceMode, exercise.id]);

  function togglePlaying() {
    if (isReferenceMode && playing) completePassRef.current();
    if (ended) {
      setCycle((c) => c + 1);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  }

  function playNote(midiNumber: number) {
    if (muted) return;
    try {
      const previewContext = new AudioContext();
      playPreviewTone(previewContext, midiNumber);
      setTimeout(() => previewContext.close(), PREVIEW_CONTEXT_LIFETIME_MS);
      setToneError(null);
    } catch (err) {
      setToneError(
        err instanceof Error ? err.message : 'Não foi possível reproduzir o áudio de referência.'
      );
    }
  }

  // One document-level listener for the whole session; it calls through a ref that is
  // refreshed every render, so shortcuts always act on the current state.
  const handleKeyDownRef = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    handleKeyDownRef.current = (event) => {
      if (helpOpen || historyOpen) return;
      const action = resolveShortcut(event);
      if (!action) return;
      event.preventDefault();
      // Held keys auto-repeat; ignore it for toggles (still prevented so Space doesn't scroll/click).
      if (event.repeat && !REPEATABLE_ACTIONS.includes(action)) return;
      switch (action) {
        case 'togglePlay':
          togglePlaying();
          break;
        case 'toggleMute':
          setMuted((m) => !m);
          break;
        case 'toggleMic':
          toggleLaneMic(PRIMARY_LANE_ID);
          break;
        case 'toggleLoop':
          setLoop((l) => !l);
          break;
        case 'nextNote':
          wheelRef.current?.navigate('next');
          break;
        case 'previousNote':
          wheelRef.current?.navigate('previous');
          break;
        case 'firstNote':
          wheelRef.current?.navigate('first');
          break;
        case 'slower':
          setPlaybackRate((r) => stepWithin(r, -PLAYBACK_RATE_STEP, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE));
          break;
        case 'faster':
          setPlaybackRate((r) => stepWithin(r, PLAYBACK_RATE_STEP, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE));
          break;
        case 'lessSensitive':
          setMicSensitivity((s) => stepWithin(s, -SENSITIVITY_STEP, MIN_SENSITIVITY, MAX_SENSITIVITY));
          break;
        case 'moreSensitive':
          setMicSensitivity((s) => stepWithin(s, SENSITIVITY_STEP, MIN_SENSITIVITY, MAX_SENSITIVITY));
          break;
        case 'previousExercise':
          onPreviousExercise();
          break;
        case 'nextExercise':
          onNextExercise();
          break;
        case 'showHelp':
          setHelpOpen(true);
          break;
        case 'showHistory':
          setHistoryOpen(true);
          break;
        case 'nextView':
          setVisualization((mode) => nextVisualization(mode));
          break;
      }
    };
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKeyDownRef.current(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  return (
    <section className="exercise-panel">
      <ScoreBoard
        rows={lanes.flatMap((lane, index) => {
          if (lane.id === effectiveReferenceId) return [];
          const pass = passTallies[lane.id] ?? EMPTY_TALLY;
          return [
            {
              laneId: lane.id,
              label: laneLabel(lane, index + 1),
              session: addTallies(sessionTallies[lane.id] ?? EMPTY_TALLY, pass),
              overall: addTallies(totalTallyForInput(history, lane.id), pass),
            },
          ];
        })}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      <div className="exercise-toolbar" role="toolbar" aria-label="Opções do exercício">
        {exerciseSelect}
        <label className="speed-control">
          Velocidade
          <input
            type="range"
            min={MIN_PLAYBACK_RATE}
            max={MAX_PLAYBACK_RATE}
            step={PLAYBACK_RATE_STEP}
            value={playbackRate}
            onChange={(event) => setPlaybackRate(Number(event.target.value))}
          />
          <span className="speed-value">{playbackRate.toFixed(2)}x</span>
        </label>
        <label className="speed-control">
          Visualização
          <select
            className="view-select"
            aria-label="Visualização"
            value={visualization}
            onChange={(event) => setVisualization(event.target.value as VisualizationMode)}
          >
            {VISUALIZATION_MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="exercise-info">
        <h2 className="exercise-title">{exercise.name}</h2>
        <p className="exercise-description">{exercise.description}</p>
        {isReferenceMode &&
          (effectiveReferenceId ? (
            <label className="speed-control">
              Referência
              <select
                className="view-select"
                aria-label="Referência"
                value={effectiveReferenceId}
                onChange={(event) => {
                  setReferenceLaneId(event.target.value);
                  saveReferenceLaneId(event.target.value);
                }}
              >
                {lanes.map((lane, index) =>
                  lane.id === PRIMARY_LANE_ID ? null : (
                    <option key={lane.id} value={lane.id}>
                      {laneLabel(lane, index + 1)}
                    </option>
                  )
                )}
              </select>
            </label>
          ) : (
            <p className="status-message">Adicione uma entrada (ex.: Monitor of …) para usar como referência.</p>
          ))}

        {toneError && (
          <p className="status-message" role="alert">
            Erro ao tocar o áudio de referência: {toneError}
          </p>
        )}
      </div>

      <div className="exercise-stage">
        <div className={lanes.length > 1 ? 'lanes lanes-multiple' : 'lanes'}>
          {lanes.map((lane, index) => (
            <InputLane
              key={lane.id}
              lane={lane}
              position={index + 1}
              sensitivity={micSensitivity}
              micEnabled={!micOff[lane.id]}
              onToggleMic={() => toggleLaneMic(lane.id)}
              targetMidiNumber={
                lane.id === effectiveReferenceId
                  ? null
                  : isReferenceMode
                    ? referenceTarget
                    : targetNote?.midiNumber ?? null
              }
              scoringActive={playing && !ended}
              audioInputs={audioInputs.inputs}
              onRefreshInputs={audioInputs.refresh}
              onSelectDevice={(deviceId) => selectLaneDevice(lane.id, deviceId)}
              onDeviceInUse={handleDeviceInUse}
              onRemove={lane.id === PRIMARY_LANE_ID ? undefined : () => removeLane(lane.id)}
              onSample={handleSample}
              onNote={handleNote}
              isReference={lane.id === effectiveReferenceId}
              onPlayNote={playNote}
              visualization={visualization}
              wheelRef={lane.id === PRIMARY_LANE_ID ? wheelRef : undefined}
            />
          ))}
        </div>
        <button type="button" className="add-lane" onClick={addLane}>
          + Adicionar entrada
        </button>
      </div>

      <div className="exercise-controls">
        <button
          type="button"
          className="icon-button"
          onClick={togglePlaying}
          aria-pressed={!playing}
          aria-label={ended ? 'Reiniciar' : playing ? 'Pausar' : 'Retomar'}
        >
          {playing ? '⏸' : '▶'}
        </button>

        {!isReferenceMode && (
          <>
            <button
              type="button"
              className="icon-button"
              onClick={() => setMuted((m) => !m)}
              aria-pressed={muted}
              aria-label={muted ? 'Ativar som' : 'Silenciar'}
            >
              {muted ? '🔇' : '🔊'}
            </button>

            <label className="loop-toggle">
              <input
                type="checkbox"
                checked={loop}
                onChange={(event) => setLoop(event.target.checked)}
              />
              Repetir
            </label>
          </>
        )}

        <label className="speed-control">
          Sensibilidade do microfone
          <input
            type="range"
            min={MIN_SENSITIVITY}
            max={MAX_SENSITIVITY}
            step={SENSITIVITY_STEP}
            value={micSensitivity}
            onChange={(event) => setMicSensitivity(Number(event.target.value))}
          />
          <span className="speed-value">{micSensitivity.toFixed(2)}</span>
        </label>
        <button
          type="button"
          className="icon-button"
          onClick={() => setHelpOpen(true)}
          aria-label="Atalhos de teclado"
        >
          ⌨️
        </button>
      </div>
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ScoreHistory open={historyOpen} onClose={() => setHistoryOpen(false)} history={history} />
    </section>
  );
}
