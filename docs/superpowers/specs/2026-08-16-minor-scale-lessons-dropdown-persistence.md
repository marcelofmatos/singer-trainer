# Lições de escala menor, dropdown de exercícios e persistência da última lição — Spec

## Contexto

O Marcelo mandou um vídeo (["Sing in Tune! Improve Your Pitch with This C Minor Vocal
Exercise"](https://www.youtube.com/watch?v=-eY1k-DPP2c), canal Dream Voice) e pediu pra
implementar as lições dele no app, além de duas mudanças de UI/persistência:

1. Trocar a lista de exercícios (hoje abas) por um dropdown.
2. Salvar a lição atual em `localStorage`, pra lembrar entre sessões.

O vídeo é um treinador visual de solfejo, sem narração — um card de título ("Intonation
Exercises / Do Minor Scale") seguido de um diagrama animado com as sílabas Dó-Ré-Mi-Fá-
Sol-Lá-Si-Dó, com um círculo destacando a nota atual, passando por: escala reta subindo,
escala reta descendo, um arco completo (sobe a oitava toda e desce) e um trecho onde cada
nota é repetida ~3x antes de descer um degrau — tudo em Dó menor.

Decisões já validadas com o Marcelo:
- **Duas lições novas**: uma escala menor "sobe-desce" (espelhando a Escala Maior que já
  existe) e uma segunda lição pro padrão de notas repetidas descendo.
- A lição de notas repetidas é **só descendo** (Dó agudo → Dó grave), 3x cada nota —
  reconstrução fiel do único frame amostrado do vídeo, não do vídeo inteiro quadro a
  quadro.
- **Dropdown com `<select>` nativo**, sem componente customizado.
- Persistência da lição atual num módulo próprio (`localStorage`), no mesmo padrão
  defensivo já usado em `playbackPreferences.ts`.

## Objetivo

Ensinar a escala menor (a lição do vídeo) usando a mesma infraestrutura de exercícios já
validada no app (feedback de afinação em tempo real, `buildScale`), e melhorar a
navegação entre lições — trocar as abas (que não escalam bem conforme o app ganha mais
exercícios) por um dropdown, lembrando a última lição escolhida entre recarregamentos de
página.

## Design

### 1. Duas novas entradas em `BUILTIN_EXERCISES` (`frontend/src/lib/exercises.ts`)

**`escala-menor-c4`** — espelha `escala-maior-c4` (mesma função `buildScale`, mesmo
`MIDDLE_C`, mesma duração de nota), só trocando os intervalos pra menor natural:

```ts
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10, 12]; // Dó-Ré-Mib-Fá-Sol-Láb-Sib-Dó
```

```ts
{
  id: 'escala-menor-c4',
  name: 'Escala Menor (Dó central)',
  category: 'escala',
  description: 'Escala menor natural de Dó4 a Dó5 e volta, mesmo formato da escala maior.',
  notes: buildScale(MIDDLE_C, MINOR_SCALE_INTERVALS, 0.6),
}
```

**`escala-menor-degraus`** — usa um novo helper `buildDescendingRepeatedScale`, exportado
ao lado de `buildScale` (mesmo espírito: função pura, sem dependência de React/DOM,
testável com valores sintéticos):

```ts
/**
 * Builds a descending note sequence where each scale degree is repeated `repeats` times
 * before stepping down to the next one — e.g. Dó5-Dó5-Dó5, Si4-Si4-Si4, Lá4-Lá4-Lá4, ...
 */
export function buildDescendingRepeatedScale(
  rootMidi: number,
  intervals: number[],
  repeats: number,
  noteDuration = 0.4
): ExerciseNote[] {
  const descending = [...intervals].reverse();
  const notes: ExerciseNote[] = [];
  descending.forEach((interval) => {
    for (let i = 0; i < repeats; i++) {
      notes.push({
        midiNumber: rootMidi + interval,
        startTime: notes.length * noteDuration,
        duration: noteDuration,
      });
    }
  });
  return notes;
}
```

```ts
{
  id: 'escala-menor-degraus',
  name: 'Escala Menor em Degraus',
  category: 'escala',
  description:
    'Dó5 até Dó4, cada nota repetida 3 vezes antes de descer um degrau — treina a ' +
    'precisão de afinação nota a nota, descendo pela escala menor.',
  notes: buildDescendingRepeatedScale(MIDDLE_C, MINOR_SCALE_INTERVALS, 3, 0.4),
}
```

`buildDescendingRepeatedScale(MIDDLE_C, MINOR_SCALE_INTERVALS, 3, 0.4)` produz 24 notas
(8 graus × 3 repetições), de Dó5 (interval 12) até Dó4 (interval 0), ~9.6s de duração
total.

Ambas entram na categoria `'escala'`, mesma categoria da Escala Maior e do Arpejo Maior.

### 2. Dropdown (`frontend/src/App.tsx`)

Troca o `<nav role="tablist">` de botões por um único `<select>`:

```tsx
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
```

CSS novo (`.exercise-select` em `index.css`) só ajusta cor de fundo/borda/texto pra
combinar com a paleta escura do app (`--color-bg-elevated`, `--color-border`,
`--color-text`) — sem reimplementar o menu aberto, que fica com a aparência nativa do
navegador. As classes `.exercise-tabs`/`.exercise-tab` (não usadas por mais nada) saem do
`index.css` junto com o JSX antigo.

### 3. Persistir a última lição (`frontend/src/lib/lastExercise.ts`, novo arquivo)

Mesmo padrão defensivo de `playbackPreferences.ts` (try/catch, validação de tipo, nunca
lança erro pro chamador):

```ts
const STORAGE_KEY = 'singer-trainer:last-exercise-id';

/** Reads the last selected exercise id from localStorage, or null if unset/invalid. */
export function loadLastExerciseId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/** Writes the last selected exercise id to localStorage; silently no-ops if unavailable. */
export function saveLastExerciseId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private browsing / quota exceeded — this is a nice-to-have, not critical.
  }
}
```

Não precisa de `JSON.parse`/`JSON.stringify` — é uma string única, não um objeto.

Em `App.tsx`, o `useState` passa a inicializar de forma preguiçosa a partir do valor
salvo, e um `useEffect` salva a cada troca — mesmo formato já usado em
`ExercisePlayer.tsx` pra `playbackRate`/`loop`/`micSensitivity`:

```ts
const [activeExerciseId, setActiveExerciseId] = useState(
  () => loadLastExerciseId() ?? BUILTIN_EXERCISES[0].id
);

useEffect(() => {
  saveLastExerciseId(activeExerciseId);
}, [activeExerciseId]);
```

A linha que já existe hoje —
`BUILTIN_EXERCISES.find((e) => e.id === activeExerciseId) ?? BUILTIN_EXERCISES[0]` —
cobre de graça o caso de um id salvo que não existe mais (ex.: exercício renomeado numa
versão futura): cai pro primeiro exercício da lista, sem precisar de validação extra no
`lastExercise.ts`.

## Testes

- `exercises.test.ts`: novos casos para `buildDescendingRepeatedScale` — contagem de
  notas (`intervals.length * repeats`), sequência de pitch (descendente, cada grau
  repetido `repeats` vezes seguidas), `startTime` sequencial sem sobreposição. Mesmo
  estilo dos testes já existentes pra `buildScale`.
- Novo `lastExercise.test.ts`: espelha os casos de `playbackPreferences.test.ts` —
  `localStorage` vazio → `null`; valor salvo → devolve o mesmo id; `localStorage`
  indisponível (ex. modo privado, `setItem`/`getItem` lançando) → não lança erro.
- `App.test.tsx`: novo caso confirmando que trocar o exercício no `<select>` persiste em
  `localStorage` (lendo a chave depois do `fireEvent.change`), e que montar o `<App />`
  de novo com essa chave já setada abre direto na lição salva.

## Fora de escopo desta mudança

- Replicar os outros padrões visuais do vídeo (escala reta só subindo, só descendo,
  arco completo) como lições separadas — o Marcelo validou que só as duas lições acima
  cobrem o que ele quer do vídeo.
- Qualquer estilização customizada do menu aberto do `<select>` (fica com a aparência
  nativa do navegador, conforme decidido).
- Mudar a categoria `'escala'` ou o tipo `ExerciseCategory` — as duas lições novas usam a
  categoria que já existe.
- Persistir mais alguma coisa além do id da lição atual (ex.: progresso dentro da lição,
  histórico) — fora de escopo do app conforme o README ("Fora de escopo (por enquanto)").
