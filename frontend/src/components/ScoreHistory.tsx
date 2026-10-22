// frontend/src/components/ScoreHistory.tsx
import { useEffect, useRef } from 'react';
import { formatSeconds, hitPercent } from '../lib/scoring';
import { bestPercentByExercise, type ScoreRecord } from '../lib/scoreHistory';

export interface ScoreHistoryProps {
  open: boolean;
  onClose: () => void;
  history: ScoreRecord[];
}

const RECENT_COUNT = 50;

/** Native modal <dialog> with the best score per exercise and the latest completed passes. */
export function ScoreHistory({ open, onClose, history }: ScoreHistoryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const best = bestPercentByExercise(history);
  const exerciseNames = new Map(history.map((entry) => [entry.exerciseId, entry.exerciseName]));
  const firstShown = Math.max(0, history.length - RECENT_COUNT);
  const recent = history.slice(firstShown).reverse();

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
              {Object.entries(best).map(([exerciseId, percent]) => (
                <tr key={exerciseId}>
                  <th scope="row">{exerciseNames.get(exerciseId)}</th>
                  <td>{percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="score-history-table" aria-label="Últimas passadas">
            <caption>Últimas passadas</caption>
            <thead>
              <tr>
                <th scope="col">Quando</th>
                <th scope="col">Exercício</th>
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
