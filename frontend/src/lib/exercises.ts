export type ExerciseCategory = 'aquecimento' | 'escala' | 'respiracao';

export interface ExerciseNote {
  midiNumber: number;
  startTime: number; // seconds from the start of the exercise
  duration: number; // seconds
}

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  description: string;
  notes: ExerciseNote[];
}

/** Builds an up-then-down note sequence (e.g. a scale) from a root note and a list of intervals. */
export function buildScale(rootMidi: number, intervals: number[], noteDuration = 0.6): ExerciseNote[] {
  const upThenDown = [...intervals, ...intervals.slice(0, -1).reverse()];
  return upThenDown.map((interval, index) => ({
    midiNumber: rootMidi + interval,
    startTime: index * noteDuration,
    duration: noteDuration,
  }));
}

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12];
const MIDDLE_C = 60;

export const BUILTIN_EXERCISES: Exercise[] = [
  {
    id: 'escala-maior-c4',
    name: 'Escala Maior (Dó central)',
    category: 'escala',
    description: 'Escala maior de Dó4 a Dó5 e volta, para aquecer a extensão vocal média.',
    notes: buildScale(MIDDLE_C, MAJOR_SCALE_INTERVALS, 0.6),
  },
  {
    id: 'sirene',
    name: 'Sirene',
    category: 'aquecimento',
    description:
      'Deslize a voz suavemente do Dó4 até o Dó5 e volta; o tom de referência marca só o início, ' +
      'o topo e o fim do percurso, para soltar a laringe.',
    notes: [
      { midiNumber: MIDDLE_C, startTime: 0, duration: 2 },
      { midiNumber: MIDDLE_C + 12, startTime: 2, duration: 2 },
      { midiNumber: MIDDLE_C, startTime: 4, duration: 2 },
    ],
  },
  {
    id: 'lip-trill',
    name: 'Lip Trill (vibração de lábios)',
    category: 'aquecimento',
    description: 'Vibre os lábios enquanto sobe e desce a escala, para relaxar e equalizar o som.',
    notes: buildScale(MIDDLE_C, MAJOR_SCALE_INTERVALS, 0.5),
  },
  {
    id: 'respiracao-sustentada',
    name: 'Respiração Sustentada',
    category: 'respiracao',
    description: 'Sustente uma nota confortável o máximo que puder com respiração controlada.',
    notes: [{ midiNumber: MIDDLE_C, startTime: 0, duration: 8 }],
  },
  {
    id: 'arpejo-maior-c4',
    name: 'Arpejo Maior',
    category: 'escala',
    description:
      'Dó-Mi-Sol-Dó e volta — um clássico de aquecimento vocal para agilidade e para conectar ' +
      'registros com mais leveza que uma escala completa.',
    notes: buildScale(MIDDLE_C, [0, 4, 7, 12], 0.5),
  },
  {
    id: 'escala-cinco-notas',
    name: 'Escala de 5 Notas',
    category: 'aquecimento',
    description:
      'Dó-Ré-Mi-Fá-Sol e volta — mais curta e suave que a escala completa, ótima para abrir a sessão.',
    notes: buildScale(MIDDLE_C, [0, 2, 4, 5, 7], 0.5),
  },
  {
    id: 'saltos-oitava',
    name: 'Saltos de Oitava',
    category: 'escala',
    description:
      'Alterna diretamente entre Dó4 e Dó5, sem escala intermediária — treina a passagem de registro.',
    notes: [
      { midiNumber: MIDDLE_C, startTime: 0, duration: 1 },
      { midiNumber: MIDDLE_C + 12, startTime: 1, duration: 1 },
      { midiNumber: MIDDLE_C, startTime: 2, duration: 1 },
      { midiNumber: MIDDLE_C + 12, startTime: 3, duration: 1 },
      { midiNumber: MIDDLE_C, startTime: 4, duration: 1 },
    ],
  },
];
