// frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { BUILTIN_EXERCISES } from './lib/exercises';
import { loadLastExerciseId, saveLastExerciseId } from './lib/lastExercise';
import { ExercisePlayer } from './components/ExercisePlayer';

export default function App() {
  const [activeExerciseId, setActiveExerciseId] = useState(
    () => loadLastExerciseId() ?? BUILTIN_EXERCISES[0].id
  );
  const activeExercise =
    BUILTIN_EXERCISES.find((exercise) => exercise.id === activeExerciseId) ?? BUILTIN_EXERCISES[0];

  useEffect(() => {
    saveLastExerciseId(activeExerciseId);
  }, [activeExerciseId]);

  function selectAdjacentExercise(offset: number) {
    const index = BUILTIN_EXERCISES.indexOf(activeExercise);
    const count = BUILTIN_EXERCISES.length;
    setActiveExerciseId(BUILTIN_EXERCISES[(index + offset + count) % count].id);
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1 className="app-title">Singer Trainer</h1>
        <p className="app-subtitle">Feedback de afinação em tempo real, ao vivo.</p>
      </header>

      <select
        className="exercise-select"
        aria-label="Exercício"
        value={activeExerciseId}
        onChange={(event) => setActiveExerciseId(event.target.value)}
      >
        {BUILTIN_EXERCISES.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
          </option>
        ))}
      </select>

      <ExercisePlayer
        exercise={activeExercise}
        onPreviousExercise={() => selectAdjacentExercise(-1)}
        onNextExercise={() => selectAdjacentExercise(1)}
      />
    </main>
  );
}
