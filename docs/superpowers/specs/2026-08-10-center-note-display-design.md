# Nota em destaque no centro da roda — Spec

## Contexto

A roda cromática (`PitchMeter`) já mostra um indicador que desliza pelo anel externo
conforme a nota cantada, mas o centro do círculo fica sempre vazio. O Marcelo pediu duas
coisas:

1. Mostrar a nota que está sendo cantada, em destaque, no meio do círculo.
2. Se o microfone não for identificado (falha/permissão negada), mostrar um ícone de
   desconexão nesse mesmo lugar.

O hook `usePitchTracker` já expõe três estados (`PitchTrackerStatus`): `requesting`
(pedindo permissão), `listening` (ouvindo) e `error` (falhou/negado). Hoje só o texto
`status-message` acima da roda (em `ExercisePlayer`) reflete esses estados — o
`PitchMeter` só recebe a nota já filtrada (`null` quando não está em `listening`).

Decisões validadas com o Marcelo:
- Centro mostra **nota + oitava** (ex.: `"A#4"`), na mesma cor do indicador de afinação
  (`STATUS_COLORS`: verde/amarelo/vermelho conforme os `cents` de desvio).
- O ícone de desconexão aparece **só no estado `error`** — não durante `requesting`
  (que dura ~1s e já tem seu próprio aviso textual acima da roda).
- Ícone de desconexão em estilo **emoji** (`🎤🚫`), consistente com os outros controles
  do app que já usam emoji (`⏸`/`▶`, `🔇`/`🔊`), em vez de um path SVG customizado.

## Objetivo

Dar um retorno visual imediato, no centro da própria roda (onde o olhar já está fixo
durante o exercício), de **qual nota está sendo captada agora** e **se o microfone parou
de responder** — sem precisar desviar o olhar para o texto de status acima.

## Design

### API do componente

`PitchMeterProps` ganha um novo prop obrigatório:

```ts
micDisconnected: boolean;
```

Nenhum prop novo é necessário para a nota — `detectedNote` já carrega `noteName` e
`octave` (`NoteInfo`, de `noteUtils.ts`).

Em `ExercisePlayer`, a única mudança é passar mais esse valor, calculado do mesmo
`pitchTracker` que já existe:

```ts
<PitchMeter
  detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
  micDisconnected={pitchTracker.status === 'error'}
  targetMidiNumber={targetNote?.midiNumber ?? null}
  onNoteClick={handleNoteClick}
/>
```

Nenhuma outra parte do fluxo de dados muda.

### Renderização

Um novo `<text>` centralizado (`x=CENTER.x`, `y=CENTER.y`) dentro do mesmo `<svg>` que já
desenha as bolhas e o indicador — sem `foreignObject`, sem overlay HTML, mesmo padrão que
o resto da roda já usa.

Prioridade de conteúdo (mutuamente exclusivos na prática, já que o tracker só reporta
`detectedNote` quando `status === 'listening'`, nunca em `error`):

1. `micDisconnected === true` → texto `"🎤🚫"`.
2. `detectedNote !== null` → texto `` `${detectedNote.noteName}${detectedNote.octave}` ``
   (ex.: `"A#4"`), `fill` = `STATUS_COLORS[status]`, reaproveitando o mesmo `status`
   (`tuningStatus(cents)`) já calculado hoje para colorir o indicador do anel.
3. Nenhum dos dois (ouvindo sem nota detectada, ou ainda em `requesting`) → nada é
   renderizado no centro, igual ao comportamento atual do indicador quando não há nota.

### Estilo

- `font-family: var(--font-display)` — a serif usada nos títulos do app, para reforçar o
  "destaque" pedido.
- Tamanho grande o bastante para ler à distância mas dentro do espaço livre no meio do
  anel (~136px de diâmetro, já que `WHEEL_RADIUS` é 90 e `BUBBLE_RADIUS` é 22): texto de
  nota em ~28px, emoji em ~32px (emoji tende a renderizar visualmente menor que texto no
  mesmo `font-size`).
- Sem círculo, fundo ou borda atrás do texto — mantém o centro limpo, do jeito que é
  hoje.

### Acessibilidade

- O `<text>` de nota é marcado `aria-hidden="true"`: ele atualiza na mesma cadência da
  detecção (~20x/seg), então virar uma live region seria ruído para leitor de tela — e
  hoje nenhuma nota detectada é anunciada em lugar nenhum da UI, então isso não regride
  nada que já existisse.
- O ícone de desconexão **também** é `aria-hidden="true"` — o aviso acessível de verdade
  já existe e continua sendo a fonte oficial: `.status-message[role="alert"]` acima da
  roda, que já anuncia a mensagem de erro específica quando `pitchTracker.status ===
  'error'`. O emoji no centro é só o eco visual rápido, não uma segunda fonte de
  informação.

## Testes

Estende `PitchMeter.test.tsx` (mesmo arquivo/padrão já existente, sem arquivo novo) com:

- Nota detectada com `targetMidiNumber` definido → texto central é `"<nota><oitava>"`
  (ex. `"A#4"`) na cor certa para cada status de afinação (`in-tune`/`close`/`off`),
  reaproveitando os mesmos cenários de cents já usados nos testes de `tuningGauge.ts`.
- `micDisconnected=true` → texto central é o ícone de desconexão, **mesmo que**
  `detectedNote` também tenha sido passado (garante a prioridade descrita acima).
- `detectedNote=null` e `micDisconnected=false` → nada é renderizado no centro.

Não é necessário um teste dedicado em `ExercisePlayer` — a mudança lá é só repassar um
booleano derivado de um estado (`pitchTracker.status`) que já existe e já é lido em outro
lugar do mesmo componente.

## Fora de escopo desta mudança

- Qualquer alteração no cálculo de pitch, cents ou status de afinação (`tuningGauge.ts`)
  — só reaproveita o que já existe.
- Estado `requesting`: continua sem nenhuma indicação no centro da roda (só o texto que
  já existe acima, "Pedindo acesso ao microfone…").
- Animações/transições na troca do texto central (aparece/some na mesma cadência atual,
  sem easing customizado) — mesmo tratamento que o indicador do anel já recebe hoje.
