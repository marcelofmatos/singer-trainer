# Novos exercícios de aquecimento + controles de reprodução/mic — Spec

## Contexto

Três pedidos combinados numa fatia só, por tocarem a mesma tela de prática:

1. **Novos exercícios**, baseados em pesquisa de técnicas de aquecimento vocal
   populares no YouTube (sirene, humming/straw phonation, escala de 5 notas, arpejo,
   vocal fry) — os padrões existentes (Sirene, Lip Trill, Escala Maior completa) já
   cobrem parte disso; faltam um arpejo, um aquecimento mais curto/suave que a escala
   completa, e um exercício de salto de oitava.
2. **Play/pause e mudo** antes da barra de velocidade.
3. **Sensibilidade do microfone**: não é ganho de áudio (o YIN já é invariante a
   amplitude — testado e confirmado em revisão anterior deste projeto), e sim o quão
   exigente o algoritmo é pra aceitar um som como nota certa (o parâmetro `threshold`
   do YIN, hoje fixo em 0.15).

## Decisões de design

### Exercícios novos

- **Arpejo Maior** (`arpejo-maior-c4`, categoria `escala`): Dó-Mi-Sol-Dó e volta
  (`buildScale(60, [0, 4, 7, 12], 0.5)`).
- **Escala de 5 Notas** (`escala-cinco-notas`, categoria `aquecimento`): Dó-Ré-Mi-Fá-Sol
  e volta (`buildScale(60, [0, 2, 4, 5, 7], 0.5)`) — mais curta que a escala completa,
  boa pra abrir a sessão.
- **Saltos de Oitava** (`saltos-oitava`, categoria `escala`): alterna Dó4/Dó5 em saltos
  diretos (sem escala intermediária) — treina passagem de registro.

### Play/pause

- Pausar **não reinicia o exercício do zero**. Usa `audioContext.suspend()`/`resume()`
  na mesma instância — o relógio de áudio (e, por consequência, o tom de referência já
  agendado e a leitura de tempo decorrido) congela e retoma exatamente de onde parou.
- A lógica de "quando o exercício termina" deixa de usar `setTimeout` (que roda em
  tempo real, ignorando a pausa) e passa a checar `audioContext.currentTime` dentro do
  mesmo polling que já atualiza `elapsed` — assim ela também respeita a pausa
  automaticamente, sem lógica duplicada.
- Trocar de exercício enquanto pausado mantém a pausa (o novo `AudioContext` já nasce
  suspenso).

### Mudo

- Um botão de mudo controla o `GainNode` do tom de referência (que passa a ser
  retornado por `playExerciseTone`, junto com o oscilador) e também impede o preview de
  tocar ao clicar numa bolha enquanto mudo.
- Não afeta o indicador de afinação ao vivo (o microfone continua funcionando
  normalmente).

### Sensibilidade do microfone

- Novo parâmetro em `usePitchTracker(sensitivity)`, repassado pro `threshold` do
  `detectPitchYIN` a cada leitura — lido via `ref` (mesmo padrão já usado pra `loop`),
  então ajustar a sensibilidade **não** pede acesso ao microfone de novo.
- Controle deslizante de 0.05 (mais exigente/estrito) a 0.35 (mais tolerante/sensível),
  padrão 0.15 (igual ao valor fixo atual).
- Persistido junto das outras preferências (`playbackPreferences.ts` ganha um terceiro
  campo).

## Proteção contra regressão

- `chromaticWheel.ts` e `PitchMeter.tsx` continuam intocados.
- `pitchDetection.ts` só ganha um `export` a mais (mesma constante, mesmo valor) —
  comportamento do algoritmo em si não muda.
- Os 68 testes existentes continuam validando tudo que já havia; os campos/exercícios
  novos ganham testes próprios seguindo o mesmo padrão dos existentes.
