# Piano-roll em blocos com preenchimento ajustável — Spec

Revisão do modo **Piano-roll** (`2026-10-23-visualization-modes-design.md`).

## Contexto

O Marcelo quer que a voz no piano-roll seja desenhada como **blocos ocupando a linha da
nota** (verde = afinado, amarelo/laranja = perto, vermelho = desafinado, vazio = sem som),
em vez de uma linha — e um controle para ir **do visual atual (linha) até os blocos
preenchendo a linha inteira**.

Decisões (validadas):
- Padrão **100%** (blocos cheios).
- Controle **"Preenchimento"** (0–100%) na barra do topo, ao lado de "Visualização",
  visível só no modo piano-roll; a escolha fica salva (`singer-trainer:piano-roll-fill`).
- Cores: as mesmas do app hoje (`STATUS_COLORS`: verde / amarelo-alaranjado / vermelho).

## Comportamento

- Cada amostra de voz (a cada 50 ms) vira um bloco com a largura daquele intervalo de
  tempo, na cor da afinação; amostras sem voz (ou fora da faixa visível) não desenham nada.
- Com preenchimento `f` (0 a 1), para a nota cantada com altura exata `p` (MIDI + cents):
  - linha da nota = `round(p)`;
  - altura do bloco = `traço + f × (altura da linha − traço)`, com `traço` ≈ 2,5 unidades;
  - centro vertical = interpolação entre a altura exata `p` (f = 0) e o centro da linha
    da nota (f = 1).
  - f = 0 → tira fina na altura exata (equivale à linha atual); f = 1 → bloco preenche a
    linha inteira da nota.
- Blocos vizinhos com a mesma linha e a mesma cor podem ser unidos num só retângulo
  (desempenho), sem mudar o visual.
- Barras-alvo, legenda colorida, nota cantada em cima e faixa automática continuam como
  estão.

## Design

- `src/lib/visualization.ts` (ou módulo próprio): `loadPianoRollFill`/`savePianoRollFill`
  (0–1, padrão 1, valor inválido → 1).
- `src/lib/pianoRoll.ts`: função pura `voiceBlocks(samples, fill, geometry)` →
  `{ x, width, y, height, status }[]` (com a união de blocos vizinhos iguais quando
  `fill === 1`).
- `PianoRollView`: prop `fill` (0–1); desenha os blocos (`data-testid="roll-voice"`,
  `data-status`) no lugar das polylines.
- `InputLane` repassa `pianoRollFill`; `ExercisePlayer` guarda o valor, mostra
  `<input type="range" aria-label="Preenchimento">` (0–100, passo 5) na barra quando a
  visualização é piano-roll e persiste.

## Testes

- Persistência: padrão 1, ida e volta, inválido → 1.
- `voiceBlocks`: f = 1 → bloco do tamanho da linha, centrado na nota arredondada; f = 0 →
  altura do traço na altura exata; f = 0,5 → intermediário; silêncio não gera bloco;
  vizinhos iguais unidos quando f = 1; cores por status.
- `PianoRollView`: blocos com `data-status` corretos; nada no silêncio.
- `ExercisePlayer`: o controle só aparece no modo piano-roll, muda o desenho e persiste.
