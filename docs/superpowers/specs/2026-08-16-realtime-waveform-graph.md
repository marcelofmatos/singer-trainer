# Gráfico de onda em tempo real — Spec

## Contexto

O Marcelo pediu, como próxima feature depois da escala menor/dropdown, um gráfico de
onda (estilo osciloscópio) mostrando a forma bruta do som que está sendo cantado — algo
bem diferente do que a roda cromática (`PitchMeter`) já mostra hoje (afinação/nota
detectada, não a forma da onda).

Decisões validadas com o Marcelo (brainstorm com companion visual):
- **Posição**: um painel novo **abaixo** da roda cromática, dentro do mesmo card do
  exercício — as duas visualizações ficam sempre visíveis juntas, não é um toggle nem
  fica lado a lado.
- **Movimento**: rolagem (estilo monitor cardíaco) — o som novo entra pela direita, o
  histórico desliza e some pela esquerda. Não é um osciloscópio "parado" que só
  redesenha no lugar.
- **Janela de tempo vis­ível**: 4 segundos.
- **Cor do traçado**: reage ao status de afinação (verde/amarelo/vermelho), a mesma
  paleta que a roda já usa no rótulo central e no indicador do anel — reforça a mesma
  leitura em mais um lugar em vez de introduzir uma cor nova sem relação com o resto da
  UI.

## Objetivo

Dar um retorno visual adicional — a forma bruta do som, não só afinação — sem abrir um
segundo acesso ao microfone nem duplicar a lógica de status de afinação que já existe.

## Design

### Fonte dos dados: reaproveitar o `AnalyserNode` que já existe

`usePitchTracker` já possui um `AnalyserNode` e lê o buffer dele 20x/seg
(`DETECTION_INTERVAL_MS = 50`) para detecção de pitch via YIN. Abrir um segundo
`getUserMedia`/`AudioContext` só para o gráfico de onda pediria uma segunda permissão de
microfone e duplicaria o grafo de áudio — em vez disso, o hook passa a **também** expor
uma janela rolante de amostras, lida do mesmo buffer já capturado a cada tick.

### Downsampling: amostragem por passo fixo (stride), não envelope min/max

O buffer bruto tem 4096 amostras por tick (~93ms a 44.1kHz) — grande demais para
empurrar inteiro num array rolante 20x/seg. Cada tick é reduzido a **8 pontos**, pegos
por passo fixo (a cada `4096/8 = 512`ª amostra), preservando o sinal (positivo/negativo)
de cada amostra escolhida.

Considerei também um "envelope" de mínimo/máximo por fatia (como editores de áudio tipo
Audacity fazem em visões zoomadas) para não perder picos entre as amostras puladas — mas
descartei: a janela por tick já é curta (~93ms) e o gráfico é uma visualização ao vivo
"decorativa" (não uma ferramenta de diagnóstico), não uma vista estática zoomada onde
picos perdidos importam de verdade. Amostragem por passo fixo é bem mais simples de
implementar/testar e, numa tela que já atualiza 20x/seg, a diferença visual entre as duas
abordagens não é perceptível a olho nu.

```ts
// frontend/src/lib/waveformSampling.ts
/**
 * Downsamples a raw audio buffer into `points` evenly-spaced signed sample values —
 * enough to draw a recognizable "wiggle" for this tick's ~50ms slice of audio without
 * pushing all 4096 raw samples into the scrolling waveform buffer every tick.
 */
export function downsampleWaveform(buffer: Float32Array, points: number): number[] {
  const stride = buffer.length / points;
  const samples: number[] = [];
  for (let i = 0; i < points; i++) {
    samples.push(buffer[Math.floor(i * stride)]);
  }
  return samples;
}
```

Módulo puro, sem dependência de React/DOM/Web Audio — mesmo padrão de `pitchDetection.ts`
e `chromaticWheel.ts`, testável com arrays sintéticos.

### `usePitchTracker`: novo campo `waveform` no estado

```ts
export interface PitchTrackerState {
  status: PitchTrackerStatus;
  errorMessage: string | null;
  currentNote: NoteInfo | null;
  waveform: number[]; // janela rolante, mais antigo primeiro, valores em [-1, 1]
}
```

Constantes novas no hook (política de buffering, não o algoritmo genérico — por isso
ficam aqui e não em `waveformSampling.ts`):

```ts
const POINTS_PER_TICK = 8;
const WINDOW_SECONDS = 4;
const WINDOW_POINTS = (WINDOW_SECONDS * 1000 / DETECTION_INTERVAL_MS) * POINTS_PER_TICK; // 640
```

No `setInterval` que já existe, o mesmo `setState` que atualiza `currentNote` passa a
também acrescentar os novos pontos e cortar o array pro tamanho da janela:

```ts
setState((prev) => ({
  ...prev,
  currentNote: result ? frequencyToNote(result.frequency) : null,
  waveform: [...prev.waveform, ...downsampleWaveform(buffer, POINTS_PER_TICK)].slice(-WINDOW_POINTS),
}));
```

Estado inicial: `waveform: []`. Sem teste de unidade dedicado pro hook em si (mesma
lacuna que já existe hoje pra `currentNote`/`status` — o hook depende de
`getUserMedia`/`AudioContext` reais, difícil de testar de forma isolada; é por isso que a
lógica de downsampling foi extraída pra um módulo puro testável à parte).

### Reaproveitar o status de afinação sem tocar na interface já publicada do `PitchMeter`

`PitchMeter` já calcula `cents`/`status` internamente a partir de `detectedNote` +
`targetMidiNumber`, só pra colorir o indicador do anel e o rótulo central
(`STATUS_COLORS[status]`). O novo `Waveform` precisa exatamente da mesma cor.

Duas opções:
- **(A) Levantar o cálculo pro `ExercisePlayer`**, passar `status` já pronto pros dois
  componentes — remove a duplicação de vez, mas muda a interface (`PitchMeterProps`) de
  um componente já implementado, testado e revisado antes, sem necessidade real (só
  reduz 3 linhas de cálculo).
- **(B) Extrair a fórmula (não o estado) pra uma função pura compartilhada**, e cada
  componente continua calculando `status` sozinho a partir dos mesmos `detectedNote`/
  `targetMidiNumber` que já recebe — sem acoplar os dois componentes entre si, sem mudar
  a interface do `PitchMeter`.

Escolhido **(B)**: menor risco (não mexe em código já validado), mantém os dois
componentes simétricos e independentes (mesmo padrão de props, cada um decidível/testável
sozinho).

```ts
// frontend/src/lib/tuningGauge.ts — adições
export const STATUS_COLORS: Record<TuningStatus, string> = {
  'in-tune': '#2ecc71',
  close: '#f1c40f',
  off: '#e74c3c',
};

/**
 * Derives the tuning status for a detected note, relative to an exercise's target note
 * (if any) or the nearest chromatic note otherwise — same cents math both PitchMeter's
 * ring indicator and the Waveform trace color themselves by.
 */
export function statusForNote(
  detectedNote: NoteInfo | null,
  targetMidiNumber: number | null
): TuningStatus | null {
  if (!detectedNote) return null;
  const cents =
    targetMidiNumber !== null
      ? (detectedNote.midiNumber - targetMidiNumber) * 100 + detectedNote.cents
      : detectedNote.cents;
  return tuningStatus(cents);
}
```

`STATUS_COLORS` sai de `PitchMeter.tsx` (onde era um const privado) e passa a viver aqui,
exportado — os dois componentes importam a mesma paleta em vez de cada um definir a sua.

`PitchMeter.tsx` troca seu cálculo inline de `cents`/`status` (linhas hoje dedicadas só a
isso) por uma chamada a `statusForNote(detectedNote, targetMidiNumber)`, e importa
`STATUS_COLORS` de `tuningGauge.ts` em vez de declarar localmente. **Nenhuma prop, nenhum
comportamento visível ou testável do componente muda** — é troca de implementação
interna, então `PitchMeter.test.tsx` não precisa de nenhuma alteração (os 14 testes
existentes continuam cobrindo o mesmo comportamento externo).

### Novo componente `Waveform`

```tsx
// frontend/src/components/Waveform.tsx
import { STATUS_COLORS, statusForNote } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';

export interface WaveformProps {
  /** Rolling window of downsampled signed amplitude values, oldest first, range [-1, 1]. */
  samples: number[];
  detectedNote: NoteInfo | null;
  targetMidiNumber: number | null;
  micDisconnected: boolean;
}

const HEIGHT = 80;
const NEUTRAL_COLOR = '#a89e93'; // --color-text-muted

export function Waveform({ samples, detectedNote, targetMidiNumber, micDisconnected }: WaveformProps) {
  const status = statusForNote(detectedNote, targetMidiNumber);
  const color = status ? STATUS_COLORS[status] : NEUTRAL_COLOR;
  const width = Math.max(samples.length - 1, 1);

  const points =
    micDisconnected || samples.length === 0
      ? ''
      : samples.map((value, index) => `${index},${(HEIGHT / 2 - value * (HEIGHT / 2)).toFixed(2)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${HEIGHT}`} width="100%" role="img" aria-label="Forma de onda da voz">
      <polyline data-testid="waveform-trace" points={points} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}
```

Mesmo padrão de props que `PitchMeter` já usa (`detectedNote`/`targetMidiNumber`/
`micDisconnected`), só acrescentando `samples` — simetria entre os dois componentes,
mesmo jeito de consumir os mesmos dados.

`viewBox` usa `samples.length` como largura em vez de uma constante fixa importada do
hook: o gráfico já aparece preenchendo a tela desde os primeiros pontos coletados, em vez
de ficar "espremido"/invisível até a janela de 4s encher pela primeira vez. Depois que a
janela enche (640 pontos), o array já vem cortado no tamanho fixo do hook e o `viewBox`
estabiliza sozinho.

`micDisconnected` zera o traçado (`points=''`) em vez de esconder o componente inteiro —
o container do SVG sempre ocupa o mesmo espaço (sem pulo de layout ao conectar/
desconectar o mic), igual ao `.wheel-stage` que também nunca desaparece.

### `ExercisePlayer`: renderiza o novo painel abaixo da roda

```tsx
<div className="wheel-stage">
  <PitchMeter
    detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
    targetMidiNumber={targetNote?.midiNumber ?? null}
    micDisconnected={pitchTracker.status === 'error'}
    onNoteClick={handleNoteClick}
  />
</div>

<div className="waveform-stage">
  <Waveform
    samples={pitchTracker.waveform}
    detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
    targetMidiNumber={targetNote?.midiNumber ?? null}
    micDisconnected={pitchTracker.status === 'error'}
  />
</div>
```

### CSS

```css
.waveform-stage {
  width: min(100%, 360px);
  height: 90px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 2rem;
  overflow: hidden;
}

.waveform-stage > svg {
  display: block;
}
```

Sem transição/animação CSS — o traçado é redesenhado a cada tick (20x/seg) via
re-render do React, mesmo tratamento que o indicador da roda já recebe hoje (sem easing
customizado).

## Testes

- `lib/waveformSampling.test.ts` (novo): `downsampleWaveform` com arrays sintéticos —
  número certo de pontos retornados, valores pegos nos índices esperados (passo fixo),
  preserva o sinal (positivo/negativo) das amostras.
- `lib/tuningGauge.test.ts`: novos casos pra `statusForNote` (mesmos cenários de cents já
  usados nos testes de `tuningStatus`, mas passando `detectedNote`/`targetMidiNumber`) e
  confirmando que `STATUS_COLORS` está exportado com as 3 chaves esperadas.
- `components/PitchMeter.test.tsx`: **sem alteração** — os 14 testes existentes precisam
  continuar passando inalterados depois do refactor interno, provando que o
  comportamento externo não mudou.
- `components/Waveform.test.tsx` (novo): traçado renderiza com o número certo de pontos
  a partir de `samples`; cor muda conforme o status de afinação (mesmos cenários de
  cents/target já usados nos testes do `PitchMeter`); `micDisconnected=true` zera o
  traçado; `samples=[]` não renderiza traçado.

## Fora de escopo desta mudança

- Qualquer normalização de amplitude (auto-ganho, compressão) — vozes baixas aparecem
  com uma onda visualmente menor, sem tratamento especial.
- Detectar desconexão de microfone que aconteça só depois da sessão já ter dados
  coletados (ex.: usuário revoga a permissão no meio do exercício) — o hook hoje não
  cobre esse caso pra `currentNote` também, então não é escopo desta feature introduzir
  isso.
- Interatividade no gráfico (zoom, pausar o traçado, clique) — só visualização passiva,
  igual o resto do feedback ao vivo do app.
