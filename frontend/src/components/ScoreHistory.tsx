// frontend/src/components/ScoreHistory.tsx
import { useEffect, useRef } from 'react';
import { CHROMATIC_NOTE_NAMES } from '../lib/chromaticWheel';
import { formatSeconds, hitPercent } from '../lib/scoring';
import { bestScores, freeNotePercentsByInput, type ScoreRecord } from '../lib/scoreHistory';

export interface ScoreHistoryProps {
  open: boolean;
  onClose: () => void;
  history: ScoreRecord[];
}

const RECENT_COUNT = 50;
const FREE_NOTES_TITLE = 'Exercício livre — acerto por nota';

/** Native modal <dialog> with the best score per exercise and the latest completed passes. */
export function ScoreHistory({ open, onClose, history }: ScoreHistoryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const firstShown = Math.max(0, history.length - RECENT_COUNT);
  const recent = history.slice(firstShown).reverse();
  const freeNotes = freeNotePercentsByInput(history);

  return (
    <dialog ref={dialogRef} className="app-dialog" aria-labelledby="score-history-title" onClose={onClose}>
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
                    {new Date(entry.finishedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
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
      <button type="button" className="app-dialog-close" onClick={onClose}>
        Fechar
      </button>
    </dialog>
  );
}
