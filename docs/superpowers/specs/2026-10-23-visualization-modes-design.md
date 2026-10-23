# Modos de visualização — Spec

## Contexto

O Marcelo perguntou se existe um padrão mais compacto e objetivo que a roda cromática.
Decidiu **manter a roda (didática) como padrão** e oferecer ao usuário mais três
visualizações consagradas: **piano-roll**, **afinador cromático** e **teclado com a tecla
acesa**.

Decisões validadas:
- **Um gráfico por faixa** (cada entrada mostra a sua visualização, como a roda hoje).
- **Oitava real**: a voz aparece na altura em que realmente está (o gráfico/teclado
  indica quando ela sai da faixa visível).
- **Teclado de duas oitavas, seguindo o exercício**.

## Seletor

- Na barra do topo (junto do exercício e da velocidade): `<select aria-label="Visualização">`
  com **Roda** (padrão), **Piano-roll**, **Afinador**, **Teclado**.
- Atalho **V** alterna para a próxima visualização (entra no mapa de atalhos e na ajuda).
- A escolha fica salva (`singer-trainer:visualization`).
- Vale para todas as faixas. A onda continua embaixo de cada faixa em todos os modos.

## As visualizações

Todas recebem a nota detectada da faixa, a nota-alvo atual (se houver) e se o microfone
está com erro. A cor da afinação segue a regra da pontuação: verde até ±10 cents da
nota-alvo **em qualquer oitava** (sem alvo: em relação à nota mais próxima), amarelo até
±25, vermelho além disso.

### Roda (padrão)
Como hoje.

### Afinador cromático
- Nome da nota cantada com a oitava, grande (ex.: "A4"); "—" sem voz.
- Barra de −50 a +50 cents (em relação à nota mais próxima) com ponteiro colorido pela
  afinação; marca central.
- Linha pequena "Alvo: C4" quando há nota-alvo.

### Teclado
- Duas oitavas (24 teclas) a partir do Dó da oitava da nota mais grave do exercício
  (exercício sem notas: Dó3 a Si4).
- Tecla-alvo com contorno; tecla cantada acesa na cor da afinação, com o desvio em cents
  ("+12 ¢") acima do teclado.
- Voz fora das duas oitavas: seta na borda ("◀ G2" / "C6 ▶") em vez de acender tecla.
- Clicar numa tecla toca aquela nota (na oitava da tecla). As setas/Home/Enter navegam e
  tocam as teclas na faixa principal, como na roda.

### Piano-roll
- Últimos 6 segundos, rolando da direita para a esquerda (amostra a cada 50 ms).
- Linhas horizontais por semitom, teclas pretas sombreadas, rótulos dos Dós (C3, C4…).
- Nota-alvo como barras ao longo do tempo; voz como linha (altura real, com cents) na cor
  da afinação de cada trecho; silêncio interrompe a linha.
- Faixa vertical automática: cobre o alvo e a voz da janela visível com 2 semitons de
  folga, mínimo de 12 semitons.

## Design

- `src/lib/visualization.ts`: tipo `VisualizationMode`, lista `VISUALIZATION_MODES` (id +
  rótulo), `loadVisualization`/`saveVisualization`, `nextVisualization`.
- `src/lib/tuningGauge.ts`: `statusForPitch(detected, targetMidi)` com a regra de oitava
  livre (reaproveita `isHit`/cents dobrados) — usado pelos modos novos.
- Componentes novos: `TunerView`, `KeyboardView` (forwardRef com o mesmo handle de
  navegação da roda), `PianoRollView`.
- `PitchMeterHandle` vira o tipo comum `NoteNavigatorHandle` (mesmo método `navigate`).
- `InputLane` recebe `visualization` e `keyboardLowMidi` e renderiza o modo escolhido.
  O clique de nota passa a ser `onPlayNote(midi)`; a roda chama com `60 + classe`.
- `ExercisePlayer`: estado + persistência do modo, seletor na barra, ação `nextView`
  (tecla V), cálculo de `keyboardLowMidi`.

## Testes

- `visualization`: carregar/salvar com valor inválido, próximo modo em ciclo.
- `statusForPitch`: oitava livre e sem alvo.
- `TunerView`: nota/oitava, posição do ponteiro, "—" sem voz, linha do alvo.
- `KeyboardView`: 24 teclas a partir do Dó dado, tecla-alvo, tecla acesa, seta fora da
  faixa, clique toca a nota da tecla, navegação pelo handle.
- `PianoRollView`: acumula amostras e descarta as antigas, desenha barra do alvo e linha da
  voz, faixa vertical cobre os dois, quebra a linha no silêncio.
- `ExercisePlayer`: seletor troca o modo de todas as faixas, V alterna, a escolha persiste.

## Fora de escopo

Piano-roll com as faixas sobrepostas; prévia das próximas notas do exercício no
piano-roll; pentagrama.
