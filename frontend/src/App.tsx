// frontend/src/App.tsx
import { useState } from 'react';
import { BUILTIN_EXERCISES, type Exercise } from './lib/exercises';
import { ExercisePlayer } from './components/ExercisePlayer';

export default function App() {
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);

  if (activeExercise) {
    return <ExercisePlayer exercise={activeExercise} onExit={() => setActiveExercise(null)} />;
  }

  return (
    <main>
      <h1>Singer Trainer</h1>
      <p>Escolha um exercício para começar, com feedback de afinação em tempo real.</p>
      <ul>
        {BUILTIN_EXERCISES.map((exercise) => (
          <li key={exercise.id}>
            <button onClick={() => setActiveExercise(exercise)}>{exercise.name}</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
