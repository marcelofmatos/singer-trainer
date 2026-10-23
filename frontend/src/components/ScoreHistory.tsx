// frontend/src/components/ScoreHistory.tsx
import { useEffect, useRef, useState } from 'react';
import { CHROMATIC_NOTE_NAMES } from '../lib/chromaticWheel';
import { formatSeconds, hitPercent } from '../lib/scoring';
import { bestScores, freeNotePercentsByInput, type ScoreRecord } from '../lib/scoreHistory';

export interface ScoreHistoryProps {
  open: boolean;
  onClose: () => void;
  history: ScoreRecord[];
  onResetSession: () => void;
  onClearHistory: () => void;
}

type ResetAction = 'session' | 'history';

const RESET_LABELS: Record<ResetAction, { idle: string; confirm: string }> = {
  session: { idle: 'Zerar sessão', confirm: 'Confirmar: zerar sessão?' },
  history: {
    idle: 'Apagar histórico',
    confirm: 'Confirmar: apagar histórico?',
  },
};

const RECENT_COUNT = 50;
const FREE_NOTES_TITLE = 'Exercício livre — acerto por nota';

/** Native modal <dialog> with the best score per exercise and the latest completed passes. */
export function ScoreHistory({ open, onClose, history, onResetSession, onClearHistory }: ScoreHistoryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // The reset waiting for its confirming second click, if any.
  const [armed, setArmed] = useState<ResetAction | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) setArmed(null);
  }, [open]);

  function handleReset(action: ResetAction) {
    if (armed !== action) {
      setArmed(action);
      return;
    }
    setArmed(null);
    if (action === 'session') onResetSession();
    else onClearHistory();
  }

  const firstShown = Math.max(0, history.length - RECENT_COUNT);
  const recent = history.slice(firstShown).reverse();
  const freeNotes = freeNotePercentsByInput(history);

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog"
      aria-labelledby="score-history-title"
      onClose={onClose}
      // The dialog itself has no padding (the body does), so a click targeting it can only be on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="app-dialog-body">
        <h2 id="score-history-title" className="app-dialog-title">
          Histórico de pontuação
        </h2>
        {history.length === 0 ? (
          <p className="score-history-empty">Nenhuma passada completa ainda.</p>
        ) : (
          <>
            <table className="score-history-table" aria-label="Recordes">
              <caption>Recordes</caption>
              <tbody>
                {bestScores(history).map((score) => (
                  <tr key={score.key}>
                    <th scope="row">
                      {score.exerciseName}
                      {score.inputLabel ? ` · ${score.inputLabel}` : ''}
                    </th>
                    <td>{score.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {freeNotes.length > 0 && (
              <div className="score-history-scroll">
                <table className="score-history-table score-history-notes" aria-label={FREE_NOTES_TITLE}>
                  <caption>{FREE_NOTES_TITLE}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Entrada</th>
                      {CHROMATIC_NOTE_NAMES.map((name) => (
                        <th key={name} scope="col">
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {freeNotes.map((row) => (
                      <tr key={row.inputId}>
                        <th scope="row">{row.inputLabel ?? 'Microfone'}</th>
                        {row.percents.map((percent, index) => (
                          <td key={CHROMATIC_NOTE_NAMES[index]}>{percent === null ? '—' : `${percent}%`}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <table className="score-history-table" aria-label="Últimas passadas">
              <caption>Últimas passadas</caption>
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">Exercício</th>
                  <th scope="col">Entrada</th>
                  <th scope="col">Afinado</th>
                  <th scope="col">Acerto</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((entry, index) => (
                  <tr key={history.length - 1 - index}>
                    <td>
                      {new Date(entry.finishedAt).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td>{entry.exerciseName}</td>
                    <td>{entry.inputLabel ?? 'Microfone'}</td>
                    <td>{formatSeconds(entry.hitSeconds)}</td>
                    <td>{hitPercent(entry)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="app-dialog-actions">
          {(['session', 'history'] as const).map((action) => (
            <button
              key={action}
              type="button"
              className={armed === action ? 'app-dialog-reset is-armed' : 'app-dialog-reset'}
              onClick={() => handleReset(action)}
            >
              {armed === action ? RESET_LABELS[action].confirm : RESET_LABELS[action].idle}
            </button>
          ))}
          <button type="button" className="app-dialog-close" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}
