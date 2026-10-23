# Atraso por entrada (calibração + ajuste fino) — Spec

## Contexto

O Marcelo viu no piano-roll que a faixa do "Monitor of …" mostra as notas visivelmente
**depois** das barras-alvo (o monitor capta o som de referência do app com ~0,1–0,3 s de
atraso: saída de áudio + captura do sistema + janela de análise ~93 ms + tick de 50 ms).
Pediu para regular isso.

Decisões validadas:
- **Calibrar sozinho + ajuste fino**: botão "Calibrar atraso" na faixa (o app toca notas de
  teste e mede quanto a entrada demora para detectá-las) e um controle deslizante em ms.
- **Vale para o desenho e para a pontuação.**

## Princípio

Cada faixa tem um atraso `L` (ms, 0–1000, padrão 0, salvo junto com a faixa). Tudo o que a
faixa detecta é tratado como ocorrido `L` ms **antes** (instante corrigido). As notas do
exercício ocorrem no horário programado; as notas da faixa de referência (modo "Entrada de
áudio") são corrigidas pelo `L` da própria referência.

## Comportamento

### Ajuste na faixa

- Botão **⏱** no cabeçalho da faixa (`aria-label="Atraso da entrada"`, mostra o valor
  quando > 0, ex.: "⏱ 180 ms") abre/fecha uma linha logo abaixo do cabeçalho com:
  - controle deslizante **"Atraso"** 0–1000 ms, passo 10, com o valor em ms;
  - botão **"Calibrar"**;
  - texto de estado da calibração ("Calibrando…", "Atraso medido: 180 ms",
    "Não foi possível calibrar: a entrada não captou as notas de teste.").
  A linha abre por cima do conteúdo (não empurra a roda/gráfico — mesma regra de layout
  estável das mensagens).

### Calibração

- Pausa o exercício, toca 6 notas de teste alternadas (C4 e G4, 350 ms cada, com 150 ms de
  silêncio entre elas) pela saída de áudio e registra o horário de início de cada uma.
- Observa as notas detectadas pela faixa; para cada nota de teste, o atraso é o tempo até a
  faixa detectar a mesma classe de altura (qualquer oitava) pela primeira vez depois do
  início, dentro de 1 s.
- Resultado = mediana dos atrasos encontrados, arredondada a 10 ms, se pelo menos 3 das 6
  notas foram detectadas; senão, falha (mensagem acima) e o valor não muda.
- Funciona direto no "Monitor of …" (capta o som do app); num microfone, precisa que o som
  de teste chegue ao mic (alto-falante).

### Pontuação

- Exercício: cada amostra da faixa (instante real `t`) é comparada com a nota do exercício
  em `t − L` (instante corrigido).
- "Entrada de áudio": as amostras da referência entram no histórico com instante
  `t − L_ref`; cada amostra de outra faixa, com instante corrigido `t − L`, casa se a
  referência cantou a mesma nota (±10 cents, qualquer oitava) entre `[corrigido − 500 ms,
  corrigido]`. Como a referência corrigida só fica conhecida com `L_ref` de atraso, a
  avaliação das amostras espera até que o histórico corrigido cubra o instante da amostra.
- Exercício livre: sem alvo, o atraso não muda a pontuação.

### Desenho

- Piano-roll: a voz da faixa é desenhada no instante corrigido (`t − L`); as barras-alvo no
  instante do alvo (exercício: programado; referência: corrigido por `L_ref`). A cor de cada
  bloco compara a voz com o alvo do mesmo instante corrigido. Com isso blocos e barras se
  alinham; a voz termina `L` antes da borda direita.
- Roda, teclado e afinador (tempo real): a faixa usa como alvo a nota do instante corrigido
  (`t − L`), para a cor da afinação não acusar erro pelo atraso.

## Design

- `inputLanes.ts`: `InputLaneConfig.latencyMs?: number` (validado 0–1000; ausente = 0).
- `src/lib/latency.ts` (puro): `estimateLatency(onsets, detections)` → `number | null`;
  `TEST_SEQUENCE` (notas/tempos); arredondamento e limites.
- `src/audio/calibrationTone.ts`: toca a sequência num `AudioContext` e devolve os horários
  de início (em `performance.now()`/`Date.now()`).
- `InputLane`: botão ⏱, linha de ajuste, calibração (usa as notas detectadas da própria
  faixa), `onLatencyChange(laneId, ms)`; repassa `latencyMs` ao piano-roll.
- `PianoRollView`: prop `latencyMs` e alvo em série própria; voz e alvo em séries
  separadas com instantes corrigidos; status calculado pelo alvo no instante corrigido.
- `ExercisePlayer`: alvo por faixa = nota do exercício em `elapsed − L`; histórico do alvo
  com instantes (para avaliar amostras corrigidas); fila de amostras por faixa avaliadas
  quando o alvo/referência corrigido do instante estiver disponível; referência com
  instantes corrigidos por `L_ref`; persiste o atraso na faixa.

## Testes

- `latency`: mediana, falha com < 3 detecções, ignora detecção de outra nota, janela de 1 s,
  arredondamento a 10 ms, limite 0–1000.
- `inputLanes`: `latencyMs` salvo/carregado, inválido → 0.
- `InputLane`: ⏱ abre a linha, slider muda o valor (callback), calibração com detecções
  simuladas mostra "Atraso medido: … ms" e chama o callback; falha mostra a mensagem.
- `PianoRollView`: com `latencyMs`, a voz é desenhada deslocada para a esquerda e casa com a
  barra-alvo do mesmo instante.
- `ExercisePlayer`: faixa com atraso 200 ms que canta a nota-alvo 200 ms depois pontua
  ~100%; sem atraso pontuaria menos; modo referência com `L_ref` e voz alinhada pontua.

## Fora de escopo

Calibração contínua/automática durante o uso; compensação diferente por modo de
visualização; medir o atraso da saída de áudio isoladamente.
