# Mostrador Circular Cromático — Spec

## Contexto

O app já entrega feedback de afinação em tempo real (texto "A4" + barra horizontal
colorida), mas o Marcelo relatou que não tem muita familiaridade com nomes/símbolos
de notas musicais. Ele pediu um mostrador mais intuitivo, inspirado num diagrama
circular que já usa no dia a dia (Círculo das Quintas) — mas esse diagrama arranja
as notas por relação harmônica (quintas), não por proximidade de altura sonora, o
que o tornaria enganoso para o propósito de "o quanto estou perto da nota certa".
A alternativa correta para esse objetivo é um **círculo cromático**: as 12 notas na
ordem da altura do som, como um relógio, onde vizinho no círculo = vizinho no som.

Decisões já validadas com o Marcelo:
- O círculo cromático **substitui** o mostrador atual (não fica em paralelo).
- Estilo visual em "bolhas" coloridas grandes com o nome dentro (espírito visual da
  imagem original, mas em ordem cromática).
- O indicador ao vivo mostra **a nota cantada** (posição contínua, não só a bolha
  mais próxima) **e** destaca a **nota-alvo** do exercício, quando houver uma tocando.

## Objetivo

Dar feedback visual de afinação que não dependa de o usuário saber ler nomes de
notas/cents — a posição no círculo e a distância até a bolha-alvo já comunicam
"pra que lado ajustar a voz" por si só.

## Design

### Geometria (módulo puro, testável)

- 12 posições fixas no círculo, uma por classe de altura (Dó, Dó#, Ré, ... Si),
  em ordem cromática horária, com Dó no topo (posição do "12h"), igual à
  convenção usada na imagem de referência do Marcelo.
- Cada posição ocupa 30° (360°/12).
- O indicador ao vivo não "pula" de bolha em bolha: sua posição angular é
  interpolada com os `cents` de desvio da nota detectada, então ele desliza
  suavemente entre duas bolhas vizinhas conforme a voz varia — é isso que torna a
  "proximidade" visível, não só a nota mais próxima.
- Essa matemática (classe de altura + cents → ângulo → ponto x/y no círculo) vive
  num módulo próprio, sem dependência de React/DOM, testável com valores
  sintéticos — mesmo padrão já usado no resto do projeto (`pitchDetection.ts`,
  `tuningGauge.ts`, etc.).
- O círculo ignora oitava (Dó4 e Dó5 caem na mesma bolha) — comportamento
  esperado desse tipo de mostrador (como um afinador cromático físico).

### Cores

- 12 cores fixas, uma por bolha, distribuídas uniformemente numa roda de matizes
  (hue steps de 30°) — reforça visualmente a metáfora de "roda/relógio", no
  espírito colorido da imagem de referência.
- Cor não é a única forma de diferenciar as notas — cada bolha sempre tem o nome
  escrito dentro, então a paleta pode priorizar impacto visual sobre a
  discriminabilidade estrita exigida em gráficos de dados (não é um gráfico
  categórico tradicional, é mais parecido com um mostrador/bússola).
- O indicador ao vivo (o ponteiro que se move) muda de cor pelo status de
  afinação já existente (`tuningGauge.ts`: `in-tune`/`close`/`off` → verde/
  amarelo/vermelho), reaproveitando a lógica atual — só muda onde essa cor é
  aplicada (no ponteiro do círculo, não mais na barra horizontal).

### Comportamento

- **Nota-alvo do exercício ativa**: a bolha correspondente ganha um destaque
  (borda/brilho) — indica pra qual bolha o usuário deve levar o ponteiro.
- **Sem nota-alvo** (entre notas do exercício, ou fora de um exercício): nenhuma
  bolha é destacada; o ponteiro ainda se move livremente e sua cor reflete o
  desvio em relação à nota cromática mais próxima (modo "afinador livre"), igual
  ao comportamento de fallback que já existe hoje.
- **Silêncio** (nenhuma nota detectada): o ponteiro desaparece, em vez de mostrar
  uma posição enganosa parado no último lugar.

### Escopo do componente

A interface pública do componente (`PitchMeterProps`: nota detectada + nota-alvo
em MIDI) **não muda** — só a renderização interna, de "texto + barra" para
"SVG com 12 bolhas + ponteiro". Isso significa que `ExercisePlayer.tsx` (quem usa
o componente) não precisa de nenhuma alteração.

## Testes

- Módulo de geometria: testes unitários com valores sintéticos (ex.: Dó exato →
  ângulo do topo; meio caminho entre Dó e Dó# → ângulo intermediário; nota vizinha
  ao "fechamento" do círculo, tipo Si→Dó, não deve dar salto para o lado errado).
- Componente: testes leves confirmando que a bolha correta fica marcada como
  alvo quando há `targetMidiNumber`, e que o indicador ao vivo reflete o status
  de afinação certo (mesmo tipo de teste que já existia pro mostrador anterior) —
  sem testar posição exata em pixels.

## Fora de escopo desta mudança

- Qualquer alteração em detecção de pitch, exercícios, ou no fluxo de
  gravação/histórico (que continuam fora de escopo do MVP, conforme o plano
  original).
- Animações de transição sofisticadas (o ponteiro atualiza na mesma cadência de
  hoje, ~20x/seg, sem easing customizado) — pode virar um refinamento futuro.
