import { formatSeconds, hitPercent, type ScoreTally } from '../lib/scoring';

export interface ScoreBoardRow {
  laneId: string;
  label: string;
  session: ScoreTally;
  overall: ScoreTally;
}

export interface ScoreBoardProps {
  rows: ScoreBoardRow[];
  onOpenHistory: () => void;
}

export function ScoreBoard({ rows, onOpenHistory }: ScoreBoardProps) {
  return (
    <button type="button" className="score-board" onClick={onOpenHistory} aria-label="Pontuação — abrir histórico">
      <span className="score-board-grid">
        <span />
        <span className="score-board-heading">Sessão</span>
        <span className="score-board-heading">Geral</span>
        {rows.map((row) => (
          <span key={row.laneId} className="score-board-row">
            <span className="score-board-label" title={row.label}>
              {row.label}
            </span>
            <span className="score-board-cell">
              <strong data-testid={`score-session-time-${row.laneId}`}>{formatSeconds(row.session.hitSeconds)}</strong>
              <strong data-testid={`score-session-percent-${row.laneId}`}>{hitPercent(row.session)}%</strong>
            </span>
            <span className="score-board-cell">
              <strong data-testid={`score-overall-time-${row.laneId}`}>{formatSeconds(row.overall.hitSeconds)}</strong>
              <strong data-testid={`score-overall-percent-${row.laneId}`}>{hitPercent(row.overall)}%</strong>
            </span>
          </span>
        ))}
      </span>
    </button>
  );
}
