// frontend/src/components/InputLane.tsx
import { useEffect, useRef, type Ref } from 'react';
import { usePitchTracker } from '../hooks/usePitchTracker';
import type { AudioInput } from '../hooks/useAudioInputs';
import { PRIMARY_LANE_ID, type InputLaneConfig } from '../lib/inputLanes';
import type { NoteInfo } from '../lib/noteUtils';
import type { VisualizationMode } from '../lib/visualization';
import { KeyboardView } from './KeyboardView';
import { PianoRollView } from './PianoRollView';
import { PitchMeter, type NoteNavigatorHandle } from './PitchMeter';
import { TunerView } from './TunerView';
import { Waveform } from './Waveform';

export interface InputLaneProps {
  lane: InputLaneConfig;
  position: number;
  sensitivity: number;
  micEnabled: boolean;
  onToggleMic: () => void;
  targetMidiNumber: number | null;
  scoringActive: boolean;
  audioInputs: AudioInput[];
  onRefreshInputs: () => void;
  onSelectDevice: (deviceId: string) => void;
  /** Reports the device (and its group) this lane's tracker actually opened; null while none is open. */
  onDeviceInUse: (laneId: string, deviceId: string | null, groupId: string | null) => void;
  onRemove?: () => void;
  /** Called on the scoring tick with what this lane hears; the player decides whether it is a hit. */
  onSample: (laneId: string, detected: NoteInfo | null) => void;
  /** Reports the note this lane currently hears; null when silent. */
  onNote: (laneId: string, note: NoteInfo | null) => void;
  /** The reference lane is heard, not scored. */
  isReference: boolean;
  onPlayNote: (midiNumber: number) => void;
  visualization: VisualizationMode;
  wheelRef?: Ref<NoteNavigatorHandle>;
  /** Sample even when there is no target note (free exercise). */
  sampleWithoutTarget?: boolean;
  /** Per-pitch-class hit rates shown on the wheel only. */
  notePercents?: (number | null)[];
  /** Piano-roll voice block fill, 0-1. */
  pianoRollFill?: number;
}

const SCORE_TICK_MS = 100;
// The wheel is octave-agnostic, so a clicked bubble previews in this fixed octave (C4-B4).
const WHEEL_OCTAVE_BASE_MIDI = 60;

/** One audio input: its own pitch tracker, wheel, waveform and device controls. */
export function InputLane({
  lane,
  position,
  sensitivity,
  micEnabled,
  onToggleMic,
  targetMidiNumber,
  scoringActive,
  audioInputs,
  onRefreshInputs,
  onSelectDevice,
  onDeviceInUse,
  onRemove,
  onSample,
  onNote,
  isReference,
  onPlayNote,
  visualization,
  wheelRef,
  sampleWithoutTarget = false,
  notePercents,
  pianoRollFill,
}: InputLaneProps) {
  const isPrimary = lane.id === PRIMARY_LANE_ID;
  // An extra lane with no device yet waits for a choice instead of opening the system default.
  const needsDevice = !isPrimary && lane.deviceId === null;
  const tracker = usePitchTracker(sensitivity, micEnabled && !needsDevice, lane.deviceId, {
    fallbackToDefault: isPrimary,
  });
  const name = isPrimary ? 'Microfone' : `Entrada ${position}`;
  const detected = tracker.status === 'listening' ? tracker.currentNote : null;
  const micDisconnected = tracker.status === 'error';
  const selectedDeviceId = tracker.deviceId ?? lane.deviceId ?? '';
  // An unplugged device isn't listed; without a placeholder the select would show another device's name.
  const deviceMissing = selectedDeviceId !== '' && !audioInputs.some((input) => input.deviceId === selectedDeviceId);

  // One fixed-height slot always renders, so a message never shifts the visualization below it.
  let statusMessage: string | null = null;
  if (tracker.status === 'requesting') statusMessage = 'Pedindo acesso ao microfone…';
  else if (tracker.status === 'error') {
    statusMessage =
      tracker.errorMessage === 'Entrada desconectada'
        ? 'Entrada desconectada'
        : `Erro ao acessar o microfone: ${tracker.errorMessage}`;
  } else if (tracker.status === 'listening' && audioInputs.length === 0) {
    statusMessage = `🎙️ ${tracker.deviceName ?? 'Microfone ativo'}`;
  } else if (tracker.status === 'off' && !needsDevice) statusMessage = 'Mic desativado';
  else if (needsDevice && audioInputs.length === 0) statusMessage = 'Escolha um dispositivo';

  // Device labels only appear once permission is granted, so re-read them when this lane opens a device.
  useEffect(() => {
    if (tracker.deviceId) onRefreshInputs();
  }, [tracker.deviceId, onRefreshInputs]);

  // Read through a ref so an inline callback from the parent doesn't re-run the effect.
  const onDeviceInUseRef = useRef(onDeviceInUse);
  useEffect(() => {
    onDeviceInUseRef.current = onDeviceInUse;
  });
  useEffect(() => {
    onDeviceInUseRef.current(lane.id, tracker.deviceId, tracker.groupId);
  }, [lane.id, tracker.deviceId, tracker.groupId]);

  // Sampled on its own tick from a ref so the interval isn't re-armed on every detection update.
  const scoringRef = useRef<{ active: boolean; target: number | null; detected: NoteInfo | null; isReference: boolean; withoutTarget: boolean }>({
    active: false,
    isReference: false,
    withoutTarget: false,
    target: null,
    detected: null,
  });
  const onSampleRef = useRef(onSample);
  useEffect(() => {
    scoringRef.current = {
      active: scoringActive && tracker.status === 'listening',
      target: targetMidiNumber,
      detected: tracker.currentNote,
      isReference,
      withoutTarget: sampleWithoutTarget,
    };
    onSampleRef.current = onSample;
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      const { active, target, detected: note, isReference: reference, withoutTarget } = scoringRef.current;
      if (!active || reference || (target === null && !withoutTarget)) return;
      onSampleRef.current(lane.id, note);
    }, SCORE_TICK_MS);
    return () => clearInterval(intervalId);
  }, [lane.id]);

  const onNoteRef = useRef(onNote);
  useEffect(() => {
    onNoteRef.current = onNote;
  });
  const reportedNote = tracker.status === 'listening' ? tracker.currentNote : null;
  useEffect(() => {
    onNoteRef.current(lane.id, reportedNote);
    // reportedNote is keyed by value (midi, cents) so a new object with the same pitch doesn't re-report.
  }, [lane.id, tracker.status, reportedNote?.midiNumber, reportedNote?.cents]);

  return (
    <div className="input-lane">
      <div className="lane-header">
        {isReference && <span className="lane-badge">Referência</span>}
        {audioInputs.length > 0 && (
          <select
            className="mic-select"
            aria-label={name}
            value={selectedDeviceId}
            onChange={(event) => onSelectDevice(event.target.value)}
          >
            {needsDevice && (
              <option value="" disabled>
                Escolha um dispositivo
              </option>
            )}
            {deviceMissing && (
              <option value={selectedDeviceId} disabled>
                Entrada desconectada
              </option>
            )}
            {audioInputs.map((input) => (
              <option key={input.deviceId} value={input.deviceId}>
                {input.label}
              </option>
            ))}
          </select>
        )}
        {isPrimary && (
          <button type="button" className="icon-button" onClick={onRefreshInputs} aria-label="Atualizar lista de microfones">
            🔄
          </button>
        )}
        <button
          type="button"
          className={micEnabled ? 'icon-button' : 'icon-button is-off'}
          onClick={onToggleMic}
          aria-pressed={!micEnabled}
          aria-label={`${micEnabled ? 'Desligar' : 'Ligar'} ${name.toLowerCase()}`}
        >
          🎙️
        </button>
        {onRemove && (
          <button type="button" className="icon-button" onClick={onRemove} aria-label={`Remover entrada ${position}`}>
            ✕
          </button>
        )}
      </div>

      <p className="lane-status" role={micDisconnected ? 'alert' : undefined}>
        {statusMessage}
      </p>

      <div className={`view-stage view-${visualization}${visualization === 'wheel' ? ' wheel-stage' : ''}`}>
        {visualization === 'wheel' && (
          <PitchMeter
            ref={wheelRef}
            detectedNote={detected}
            targetMidiNumber={targetMidiNumber}
            micDisconnected={micDisconnected}
            notePercents={notePercents}
            onNoteClick={(pitchClass) => onPlayNote(WHEEL_OCTAVE_BASE_MIDI + pitchClass)}
          />
        )}
        {visualization === 'keyboard' && (
          <KeyboardView
            ref={wheelRef}
            detectedNote={detected}
            targetMidiNumber={targetMidiNumber}
            micDisconnected={micDisconnected}
            onPlayNote={onPlayNote}
          />
        )}
        {visualization === 'tuner' && (
          <TunerView detectedNote={detected} targetMidiNumber={targetMidiNumber} micDisconnected={micDisconnected} />
        )}
        {visualization === 'piano-roll' && (
          <PianoRollView
            detectedNote={detected}
            targetMidiNumber={targetMidiNumber}
            micDisconnected={micDisconnected}
            fill={pianoRollFill}
          />
        )}
      </div>
      <div className="waveform-stage">
        <Waveform
          samples={tracker.waveform}
          detectedNote={detected}
          targetMidiNumber={targetMidiNumber}
          micDisconnected={micDisconnected}
        />
      </div>
    </div>
  );
}
