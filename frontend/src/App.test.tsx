// frontend/src/App.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { BUILTIN_EXERCISES } from './lib/exercises';

describe('App', () => {
  it('lists every built-in exercise for picking', () => {
    render(<App />);
    BUILTIN_EXERCISES.forEach((exercise) => {
      expect(screen.getByText(exercise.name)).toBeDefined();
    });
  });
});
