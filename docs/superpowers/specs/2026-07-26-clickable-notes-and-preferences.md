# Bolhas clicáveis + preferências persistidas — Spec

## Contexto

O Marcelo pediu duas melhorias pequenas e independentes na tela de prática:

1. **Clicar numa bolha da roda cromática toca a nota correspondente** — útil
   pra quem não sabe de ouvido qual é "Dó" e quer conferir antes de tentar
   cantar.
2. **Velocidade e repetição salvas no `localStorage`** — hoje esses ajustes já
   sobrevivem à troca de aba (o `ExercisePlayer` fica montado), mas se perdem
   ao recarregar a página.

## Decisões de design

### Bolhas clicáveis

- `PitchMeter` continua um componente puro/apresentacional — não passa a
  depender de `AudioContext`. Ganha uma prop opcional
  `onNoteClick?: (pitchClassIndex: number) => void`; cada bolha vira um botão
  clicável (`<button>` dentro do SVG via `<g role="button">`, ou um elemento
  focável equivalente) que chama esse callback com o índice da classe de
  altura clicada (0=Dó ... 11=Si), sem saber nada sobre áudio.
- `ExercisePlayer` implementa o callback: cria um `AudioContext` de vida curta
  e toca a nota clicada por ~0.5s numa oitava fixa (Dó4=60 como base, ou seja,
  MIDI = `60 + pitchClassIndex`), reaproveitando o padrão já usado no tom de
  referência (`oscillator` + `GainNode` com volume baixo). Falha ao tocar
  (mesmo tratamento de erro já existente pro tom de referência) usa o mesmo
  estado `toneError`.
- Isso não interfere na reprodução do exercício em andamento nem no indicador
  ao vivo — é um contexto de áudio à parte, criado e fechado a cada clique.

### Preferências persistidas

- Novo módulo puro `frontend/src/lib/playbackPreferences.ts`:
  `loadPlaybackPreferences()` lê do `localStorage` (com validação defensiva —
  JSON corrompido ou tipos errados caem no padrão `{playbackRate: 1, loop:
  false}`) e `savePlaybackPreferences(prefs)` grava. Ambas silenciosamente
  toleram `localStorage` indisponível (modo privado, cota excedida) — é uma
  conveniência, não algo crítico.
- `ExercisePlayer` inicializa `playbackRate`/`loop` a partir desse módulo (via
  inicializador preguiçoso do `useState`) e grava a cada mudança.
- Escopo global (uma preferência só, compartilhada entre todos os
  exercícios) — não por exercício individual, consistente com o
  comportamento que já existe em memória hoje (a velocidade escolhida já
  atravessa trocas de aba).

## Proteção contra regressão

- Os 58 testes já existentes continuam intactos; `chromaticWheel.ts`
  permanece sem alterações (só `PitchMeter.tsx` ganha a prop nova, que é
  opcional e não quebra nenhum uso existente sem ela).
- `playbackPreferences.ts` é testável de verdade em jsdom (diferente de
  `AudioContext`/microfone, o `localStorage` é implementado pelo jsdom) —
  ganha testes unitários completos.
- A nova prop de `PitchMeter` ganha testes próprios (clique dispara o
  callback com o índice certo; sem a prop, o clique não quebra nada).

## Fora de escopo

- Tocar a nota clicada respeitando a oitava real do exercício em andamento
  (sempre toca na oitava fixa Dó4-Si4, independente do exercício).
- Persistir preferências por exercício individual.
