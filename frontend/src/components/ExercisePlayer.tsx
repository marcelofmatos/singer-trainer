// frontend/src/components/ExercisePlayer.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise } from '../lib/exercises';
import { exerciseDuration, noteAtTime, scaleExerciseTiming } from '../lib/exerciseTiming';
import { loadPlaybackPreferences, savePlaybackPreferences } from '../lib/playbackPreferences';
import { playExerciseTone, REFERENCE_TONE_GAIN } from '../audio/referenceTone';
import { playPreviewTone } from '../audio/previewTone';
import { usePitchTracker } from '../hooks/usePitchTracker';
import { resolveShortcut, stepWithin } from '../lib/keyboardShortcuts';
import { KeyboardHelp } from './KeyboardHelp';
import { PitchMeter } from './PitchMeter';
import { Waveform } from './Waveform';

export interface ExercisePlayerProps {
  exercise: Exercise;
  onPreviousExercise: () => void;
  onNextExercise: () => void;
}

const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2;
const PLAYBACK_RATE_STEP = 0.25;
const MIN_SENSITIVITY = 0.05;
const MAX_SENSITIVITY = 0.35;
const SENSITIVITY_STEP = 0.05;
// The wheel is octave-agnostic, so a clicked bubble always previews in this fixed octave (C4-B4).
const PREVIEW_OCTAVE_BASE_MIDI = 60;
const PREVIEW_CONTEXT_LIFETIME_MS = 600;

export function ExercisePlayer({ exercise, onPreviousExercise, onNextExercise }: ExercisePlayerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(() => loadPlaybackPreferences().playbackRate);
  const [loop, setLoop] = useState(() => loadPlaybackPreferences().loop);
  const [micSensitivity, setMicSensitivity] = useState(
    () => loadPlaybackPreferences().micSensitivity
  );
  const [playing, setPlaying] = useState(true);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [toneError, setToneError] = useState<string | null>(null);
  const pitchTracker = usePitchTracker(micSensitivity, micEnabled);

  // Read via refs inside the effect below so toggling these controls mid-playback
  // doesn't restart the currently-playing cycle from scratch.
  const loopRef = useRef(loop);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

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
  useEffect(() => {
    mutedRef.current = muted;
    const gain = gainRef.current;
    if (!gain) return;
    gain.gain.value = muted ? 0 : REFERENCE_TONE_GAIN;
  }, [muted]);

  useEffect(() => {
    savePlaybackPreferences({ playbackRate, loop, micSensitivity });
  }, [playbackRate, loop, micSensitivity]);

  const scaledExercise = useMemo(
    () => scaleExerciseTiming(exercise, playbackRate),
    [exercise, playbackRate]
  );

  useEffect(() => {
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

      pollTimer = setInterval(() => {
        if (!audioContext) return;
        const currentTime = audioContext.currentTime;
        setElapsed(currentTime);
        if (!hasEnded && currentTime >= exerciseDuration(scaledExercise)) {
          hasEnded = true;
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
  }, [scaledExercise, cycle]);

  const targetNote = noteAtTime(scaledExercise, elapsed);

  function togglePlaying() {
    if (ended) {
      setCycle((c) => c + 1);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  }

  function handleNoteClick(pitchClass: number) {
    if (muted) return;
    try {
      const previewContext = new AudioContext();
      playPreviewTone(previewContext, PREVIEW_OCTAVE_BASE_MIDI + pitchClass);
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
      if (helpOpen) return;
      const action = resolveShortcut(event);
      if (!action) return;
      event.preventDefault();
      switch (action) {
        case 'togglePlay':
          togglePlaying();
          break;
        case 'toggleMute':
          setMuted((m) => !m);
          break;
        case 'toggleMic':
          setMicEnabled((on) => !on);
          break;
        case 'toggleLoop':
          setLoop((l) => !l);
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
      <div className="exercise-info">
        <h2 className="exercise-title">{exercise.name}</h2>
        <p className="exercise-description">{exercise.description}</p>

        {pitchTracker.status === 'requesting' && (
          <p className="status-message">Pedindo acesso ao microfone…</p>
        )}
        {pitchTracker.status === 'error' && (
          <p className="status-message" role="alert">
            Erro ao acessar o microfone: {pitchTracker.errorMessage}
          </p>
        )}
        {pitchTracker.status === 'off' && <p className="status-message">Microfone desligado</p>}
        {toneError && (
          <p className="status-message" role="alert">
            Erro ao tocar o áudio de referência: {toneError}
          </p>
        )}
      </div>

      <div className="exercise-stage">
        <div className="wheel-stage">
          <PitchMeter
            detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
            targetMidiNumber={targetNote?.midiNumber ?? null}
            micDisconnected={pitchTracker.status === 'error'}
            onNoteClick={handleNoteClick}
          />
        </div>

        <div className="waveform-stage">
          <Waveform
            samples={pitchTracker.waveform}
            detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
            targetMidiNumber={targetNote?.midiNumber ?? null}
            micDisconnected={pitchTracker.status === 'error'}
          />
        </div>
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

        <button
          type="button"
          className="icon-button"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          aria-label={muted ? 'Ativar som' : 'Silenciar'}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        <button
          type="button"
          className={micEnabled ? 'icon-button' : 'icon-button is-off'}
          onClick={() => setMicEnabled((on) => !on)}
          aria-pressed={!micEnabled}
          aria-label={micEnabled ? 'Desligar microfone' : 'Ligar microfone'}
        >
          🎙️
        </button>

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

        <label className="loop-toggle">
          <input
            type="checkbox"
            checked={loop}
            onChange={(event) => setLoop(event.target.checked)}
          />
          Repetir
        </label>

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
    </section>
  );
}
