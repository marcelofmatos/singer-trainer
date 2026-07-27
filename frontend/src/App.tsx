// frontend/src/App.tsx
import { useState } from 'react';
import { BUILTIN_EXERCISES } from './lib/exercises';
import { ExercisePlayer } from './components/ExercisePlayer';

export default function App() {
  const [activeExerciseId, setActiveExerciseId] = useState(BUILTIN_EXERCISES[0].id);
  const activeExercise =
    BUILTIN_EXERCISES.find((exercise) => exercise.id === activeExerciseId) ?? BUILTIN_EXERCISES[0];

  return (
    <main className="app">
      <header className="app-header">
        <h1 className="app-title">Singer Trainer</h1>
        <p className="app-subtitle">Feedback de afinação em tempo real, ao vivo.</p>
      </header>

      <nav className="exercise-tabs" role="tablist" aria-label="Exercícios">
        {BUILTIN_EXERCISES.map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            role="tab"
            aria-selected={exercise.id === activeExerciseId}
            className="exercise-tab"
            onClick={() => setActiveExerciseId(exercise.id)}
          >
            {exercise.name}
          </button>
        ))}
      </nav>

      <ExercisePlayer exercise={activeExercise} />
    </main>
  );
}
