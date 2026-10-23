# Exercício "Entrada de áudio" (referência ao vivo) — Spec

Depende de "Várias entradas" (`2026-10-22-multi-input-lanes-design.md`) e "Pontuação e
histórico".

## Contexto

O Marcelo quer usar uma entrada de áudio — tipicamente o "Monitor of …" que capta a voz de
um vídeo tocando em outra aba — como **referência das notas que deve cantar** e como
**comparação**.

Decisões validadas:
- **Novo item no seletor de exercício**: "Entrada de áudio". Ao escolher, o usuário indica
  qual entrada é a referência; a faixa dela vira "Referência", **não é pontuada**, e as
  notas dela viram a **nota-alvo de todas as outras faixas** (roda, teclado, piano-roll,
  afinador).
- **O tempo conta quando a referência canta** (tem nota detectada). Se a referência canta
  e a faixa não, conta como erro. Intervalos/silêncio do vídeo não contam.
- **Tolerância de ~0,5 s** para o atraso: é acerto se a faixa canta (±10 cents, qualquer
  oitava) alguma nota que a referência cantou nos últimos 500 ms.
- O **exercício livre** continua na fila, depois deste.

## Comportamento

- Item "Entrada de áudio" no seletor, com descrição: "Use uma das entradas (ex.: o
  'Monitor of …' com um vídeo tocando) como referência das notas a cantar."
- Sem som de referência e sem relógio de exercício. Play/pausa pausa a contagem.
  Somem os botões de som (🔊) e "Repetir"; a velocidade continua na barra (sem efeito aqui).
- Na coluna da esquerda, abaixo da descrição: `<select aria-label="Referência">` com as
  faixas pelo nome. Padrão: a primeira faixa cujo dispositivo começa com "Monitor of"; se
  não houver, a primeira faixa extra (o padrão é salvo assim que os nomes dos dispositivos
  aparecem, para que adicionar uma entrada depois não troque a referência); se só existir a faixa principal, a mensagem
  "Adicione uma entrada (ex.: Monitor of …) para usar como referência." e nada é pontuado.
  A escolha fica salva (`singer-trainer:reference-lane`).
- A faixa de referência mostra um selo **"Referência"** no cabeçalho, a própria
  visualização sem alvo, e não aparece no placar.
- Nas outras faixas, a nota-alvo é a nota atual da referência (arredondada ao semitom;
  nula no silêncio dela) — o piano-roll mostra as barras-alvo seguindo a referência.

## Pontuação

- A cada 100 ms, para cada faixa não-referência com microfone ouvindo, se estiver tocando
  (não pausado) e a referência tiver nota: soma 0,1 s ao tempo de alvo; é acerto se a
  nota da faixa casa (±10 cents, qualquer oitava) com alguma amostra da referência dos
  últimos 500 ms.
- Grava um registro por faixa pontuada (exercício "Entrada de áudio") **ao pausar**,
  **ao trocar de exercício** e **ao ocultar/fechar a página** (`visibilitychange` →
  hidden, `pagehide`), se o tempo de alvo > 0; depois zera a contagem.
- Placar e histórico como nos outros exercícios (sessão/geral por faixa).

## Design

- `exercises.ts`: `Exercise.mode?: 'reference'`; `AUDIO_INPUT_EXERCISE` (id
  `entrada-de-audio`, sem notas) em `BUILTIN_EXERCISES`.
- `src/lib/referenceMatch.ts` (puro): `ReferenceSample { time, midi, cents }`,
  `pushReferenceSample(history, sample, windowMs)`, `matchesReference(detected, history,
  now, toleranceMs)`, `defaultReferenceLaneId(lanes, labelOf)`,
  `loadReferenceLaneId`/`saveReferenceLaneId`.
- `InputLane`: `onSample(laneId, detected)` passa a nota detectada (o player decide o
  acerto); prop `isReference` (selo, sem pontuação); prop `onNote(laneId, note)` reporta a
  nota atual (usada pela faixa de referência).
- `ExercisePlayer`: no modo referência, pula o efeito de tom/relógio; guarda o histórico da
  referência num ref e o alvo atual em estado (só muda quando o semitom muda); decide o
  acerto com `matchesReference` (no modo exercício, com `isHit` contra a nota do
  exercício, como hoje); grava nos gatilhos acima; esconde 🔊 e Repetir.

## Testes

- `referenceMatch`: janela, acerto dentro de 500 ms em qualquer oitava, fora da janela não
  casa, sem amostras não casa, escolha padrão da referência, persistência.
- `InputLane`: selo "Referência", `onNote`, `onSample` com a nota.
- `ExercisePlayer` (trackers mockados por dispositivo): faixas não-referência recebem o
  alvo da referência; cantar a nota da referência com 300 ms de atraso conta como acerto;
  silêncio da referência não conta tempo; a referência não pontua nem aparece no placar;
  pausar grava; trocar de exercício grava; ocultar a página grava; sem entrada extra mostra
  a mensagem e não pontua; 🔊/Repetir ausentes.

## Fora de escopo

Compensação automática de latência; separar a voz da música (o YIN mede o que estiver mais
forte no monitor); mais de uma referência.
