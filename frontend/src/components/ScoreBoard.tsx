// frontend/src/components/ScoreBoard.tsx
import { formatSeconds, hitPercent, type ScoreTally } from '../lib/scoring';

export interface ScoreBoardProps {
  session: ScoreTally;
  overall: ScoreTally;
  onOpenHistory: () => void;
}

export function ScoreBoard({ session, overall, onOpenHistory }: ScoreBoardProps) {
  return (
    <button type="button" className="score-board" onClick={onOpenHistory} aria-label="Pontuação — abrir histórico">
      <span className="score-board-grid">
        <span />
        <span className="score-board-heading">Sessão</span>
        <span className="score-board-heading">Geral</span>
        <span className="score-board-label">Afinado</span>
        <strong data-testid="score-session-time">{formatSeconds(session.hitSeconds)}</strong>
        <strong data-testid="score-overall-time">{formatSeconds(overall.hitSeconds)}</strong>
        <span className="score-board-label">Acerto</span>
        <strong data-testid="score-session-percent">{hitPercent(session)}%</strong>
        <strong data-testid="score-overall-percent">{hitPercent(overall)}%</strong>
      </span>
    </button>
  );
}
