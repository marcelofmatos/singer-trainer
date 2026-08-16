# Rastro no indicador e anel vazado — Spec

## Contexto

O Marcelo pediu duas mudanças relacionadas no indicador que desliza pela roda cromática
(o círculo que mostra a nota sendo cantada, em tempo real):

1. O indicador hoje "pula" de posição a cada ~50ms sem transição — pediu algum tipo de
   "rastro" ou animação coerente pra não ficar tão "dura" a apresentação, com um
   fadeout ajudando quando a voz para.
2. O indicador hoje é um círculo sólido preenchido — quando passa perto/sobre uma bolha
   de nota, tampa a letra dela. Pediu trocar por um anel vazado (borda grossa, meio
   transparente), do tamanho perto do das bolhas, pra letra continuar visível por baixo.

Decisões validadas com o Marcelo (brainstorm com mockups):
- **Anel vazado**, sem preenchimento, sem o contorno branco+preto de contraste que
  existe hoje — só o traço colorido pela cor de afinação.
- **Raio do anel ≈ 20px** (raio da bolha é 22px — fica quase do mesmo tamanho, a letra
  da bolha continua visível através do meio transparente).
- **Rastro fantasma (opção C do brainstorm)**: posições recentes do indicador ficam
  visíveis por um instante, cada vez mais transparentes — sem transição CSS de posição
  (o "fluido" vem do próprio rastro, não de interpolar entre dois pontos).
- **Fadeout no silêncio**: quando a voz para, o rastro não some de uma vez — ele
  "envelhece" removendo um ponto por tick, até esvaziar.

## Objetivo

Deixar o feedback visual da afinação menos "robótico" (sem depender de interpolação de
posição) e não esconder a letra da bolha de nota embaixo do indicador.

## Design

### Redesenho visual: anel vazado no lugar do círculo sólido

Cada ponto do rastro vira um único `<circle>` sem preenchimento (`fill="none"`), com
`stroke` na cor de afinação (`STATUS_COLORS[status]`) e `strokeWidth` grosso — substitui
o grupo de 3 círculos concêntricos de hoje (branco + preto + preenchido).

```
RING_RADIUS = 20        // raio do anel — raio da bolha é 22
RING_STROKE_WIDTH = 5
```

### Por que um relógio próprio, não o ciclo de render do React

O rastro precisa **continuar envelhecendo mesmo em silêncio total**, quando não chegam
mais props novas do componente pai. Duas formas óbvias de implementar isso têm problema:

- **`useEffect` sem array de dependências** (roda a cada render): funciona pra envelhecer
  durante silêncio (desde que *algo* continue causando re-render), mas arrisca um loop —
  toda chamada de `setState` dispara outro render, que dispara o efeito de novo, que
  chama `setState` de novo... Só para quando o estado realmente estabiliza numa mesma
  referência, o que não acontece ao empilhar pontos novos durante o canto.
- **`useEffect` com array de dependências** (ex.: `[indicatorPosition?.x, status]`): evita
  o loop, mas trava o rastro pela metade — quando o silêncio começa, o efeito dispara
  **uma vez** (a posição virou `null`), mas como `null` não muda entre re-renders
  seguintes, o efeito não dispara de novo, e o rastro nunca termina de esvaziar.

A solução: o próprio `PitchMeter` mantém um relógio interno (`setInterval`, mesma cadência
de 50ms do hook de detecção de pitch), independente do ciclo de render do React —
mesmo padrão que `usePitchTracker.ts` já usa pra sua própria detecção. Um `useRef`
guarda sempre a última posição/status computados (sincronizado por um efeito sem
dependências, mas que só *mexe numa ref*, nunca chama `setState` — então não tem risco
de loop). O `setInterval` lê essa ref a cada tick e decide se acrescenta um ponto novo ou
envelhece um antigo.

```ts
const currentPositionRef = useRef<{ x: number; y: number; status: TuningStatus } | null>(null);
useEffect(() => {
  currentPositionRef.current = indicatorPosition && status ? { x: indicatorPosition.x, y: indicatorPosition.y, status } : null;
});

const nextTrailIdRef = useRef(0);
const [trail, setTrail] = useState<TrailPoint[]>([]);
useEffect(() => {
  const intervalId = setInterval(() => {
    const current = currentPositionRef.current;
    const point: TrailPoint | null = current ? { id: nextTrailIdRef.current++, ...current } : null;
    setTrail((prev) => advanceTrail(prev, point, TRAIL_LENGTH));
  }, TRAIL_TICK_MS);
  return () => clearInterval(intervalId);
}, []);
```

`PitchMeterProps` **não muda** — o rastro é inteiramente interno ao componente.

### `advanceTrail`: a lógica de avançar o rastro, extraída como função pura

Mesmo padrão já usado no projeto (`pitchDetection.ts`, `waveformSampling.ts`): a
transformação do array (empilhar-e-cortar, ou envelhecer-um) não depende de
React/timers/DOM, então vira uma função pura testável à parte, em vez de ficar só dentro
do componente.

```ts
// frontend/src/lib/indicatorTrail.ts
/**
 * Advances a fixed-length trail of recent values by one tick: appends `next` and caps
 * the trail at `maxLength` when there's a new value, or drops the oldest entry when
 * there isn't (letting an existing trail fade out gracefully instead of vanishing) —
 * returns the same array reference when there's nothing left to age out, so callers
 * relying on reference equality (e.g. React state) can bail out of re-rendering.
 */
export function advanceTrail<T>(prev: T[], next: T | null, maxLength: number): T[] {
  if (next !== null) {
    return [...prev, next].slice(-maxLength);
  }
  if (prev.length === 0) return prev;
  return prev.slice(1);
}
```

```
TRAIL_LENGTH = 6        // ~300ms de rastro a 50ms/tick
TRAIL_TICK_MS = 50       // mesma cadência do hook de detecção de pitch
```

### Renderização: opacidade cresce do mais antigo pro mais recente

```tsx
{trail.map((point, index) => (
  <circle
    key={point.id}
    data-testid={index === trail.length - 1 ? 'live-indicator' : 'live-indicator-trail'}
    data-status={point.status}
    cx={point.x}
    cy={point.y}
    r={RING_RADIUS}
    fill="none"
    stroke={STATUS_COLORS[point.status]}
    strokeWidth={RING_STROKE_WIDTH}
    opacity={(index + 1) / trail.length}
  />
))}
```

O **último elemento** do array (mais recente) sempre tem opacidade 1.0 e recebe o mesmo
`data-testid="live-indicator"` que já existe hoje — mantém a maior parte dos testes atuais
válidos conceitualmente (só precisam esperar o primeiro tick do relógio interno antes de
checar). Os pontos mais antigos (o rastro em si) recebem `data-testid="live-indicator-trail"`
(repetido, consultável com `getAllByTestId`/`queryAllByTestId`).

`key={point.id}` usa um contador incremental (não o índice do array) — o array é uma
fila real (entra no fim, sai do início), então os índices dos elementos mudam a cada
tick; usar índice como `key` faria o React reatribuir os elementos errados durante o
envelhecimento.

## Testes

### `lib/indicatorTrail.test.ts` (novo)

Casos sintéticos, sem DOM/timers — array genérico de números:
- Acrescenta um valor novo ao fim.
- Corta no `maxLength`, descartando os mais antigos primeiro.
- Sem valor novo: remove o mais antigo (envelhece).
- Já vazio e sem valor novo: devolve a **mesma referência** (para o bail-out do React
  funcionar).
- Rastro vazio + valor novo: começa o rastro.

### `components/PitchMeter.test.tsx`

Os 14 testes existentes continuam, mas os que checam `live-indicator` precisam de
`vi.useFakeTimers()` (novo em `beforeEach`/`afterEach` do arquivo) e um
`act(() => vi.advanceTimersByTime(TRAIL_TICK_MS))` antes de consultar — o rastro começa
vazio até o primeiro tick do relógio interno rodar. Os testes que não tocam no indicador
(bolhas, clique, rótulo central, ícone de mic desconectado) não mudam.

4 testes novos:
- Depois de alguns ticks com nota detectada, o rastro cresce (`live-indicator-trail`
  aparece, em quantidade = ticks − 1).
- Depois de muitos ticks, o rastro para de crescer no `TRAIL_LENGTH` (6, então 5
  elementos de rastro + 1 atual).
- Ao parar de detectar nota (`detectedNote=null` via `rerender`), o rastro cheio perde
  **um** ponto por tick, não desaparece de uma vez.
- Depois de silêncio suficiente (mesmo número de ticks que o tamanho do rastro), o
  rastro esvazia por completo — `live-indicator` e `live-indicator-trail` somem.

## Fora de escopo desta mudança

- Transição CSS suave de posição (interpolar entre dois pontos) — a decisão foi usar só
  o rastro fantasma pra dar sensação de movimento, sem misturar as duas técnicas.
- Qualquer mudança no destaque da bolha-alvo do exercício (contorno branco/preto que já
  existe) ou no rótulo central — só o indicador que desliza pelo anel muda.
- Configurar `TRAIL_LENGTH`/`TRAIL_TICK_MS` como preferência do usuário — valores fixos
  por enquanto, como o resto dos parâmetros visuais do app.
