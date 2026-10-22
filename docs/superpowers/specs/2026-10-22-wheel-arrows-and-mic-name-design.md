# Setas na roda por padrão e nome do microfone — Spec

Revisão da spec `2026-10-22-keyboard-controls-design.md` (versão 1.2.0).

## Contexto

Feedback do Marcelo sobre a 1.2.0:

1. As setas só navegavam entre as notas depois de focar (clicar) uma nota; fora da roda
   elas mudavam velocidade/sensibilidade. Ficou estranho. Pedido: **setas navegam nas
   notas por padrão**, e velocidade/sensibilidade ganham teclas novas.
2. Mostrar o **nome do microfone ativo**; quando desligado, "Mic desativado".

Decisões validadas:
- Velocidade: `-` / `+` (o `=` também vale, sem Shift). Sensibilidade: `,` / `.`.
- **Espaço é sempre play/pausa**, inclusive com uma nota selecionada; Enter toca a nota.
- As duas mudanças saem na mesma versão.
- Decisão de detalhe: com o foco fora da roda, a primeira seta **entra** na roda na nota
  selecionada por último (inicialmente C), sem avançar; as seguintes giram.

## Mapa de atalhos (substitui o da 1.2.0)

| Tecla                 | Ação                                                     |
| --------------------- | -------------------------------------------------------- |
| Espaço                | Play / pausar / reiniciar o exercício (sempre)           |
| → / ↓                 | Próxima nota da roda (sentido horário, volta B→C)        |
| ← / ↑                 | Nota anterior (anti-horário, volta C→B)                  |
| Home                  | Vai para o C                                             |
| Enter (nota focada)   | Toca a nota (comportamento do botão da nota)             |
| `-`                   | Velocidade − (um passo: 0,25x)                           |
| `+` ou `=`            | Velocidade +                                             |
| `,`                   | Sensibilidade − (um passo: 0,05)                         |
| `.`                   | Sensibilidade +                                          |
| S / M / R             | Som / microfone / repetir (sem mudança)                  |
| PageUp ou `[`         | Exercício anterior (sem mudança)                         |
| PageDown ou `]`       | Próximo exercício (sem mudança)                          |
| `?`                   | Ajuda (sem mudança)                                      |

Repetição ao segurar: só as setas e os passos de velocidade/sensibilidade repetem.

### Teclas que ficam com o elemento focado

- `select`, `textarea`, `input` de texto: todas.
- `input[type=range]`: setas, PageUp, PageDown, Home e End (o slider se move).
- `button` e `input[type=checkbox]`: só Espaço.
- Notas da roda (`role="button"`): nenhuma — setas, Home e Espaço vão para os atalhos
  globais; Enter é tratado pela própria nota.

Ctrl/Alt/Meta e painel de ajuda aberto continuam desativando os atalhos.

## Design

### `keyboardShortcuts.ts`

- Ações novas: `nextNote`, `previousNote`, `firstNote`. As ações `slower`, `faster`,
  `lessSensitive`, `moreSensitive` passam para `-`, `+`/`=`, `,`, `.`.
- `keysOwnedByFocus` segue a tabela acima. `SHORTCUT_HELP` reflete o novo mapa.

### `PitchMeter` — navegação controlada de fora

- Vira `forwardRef` e expõe `PitchMeterHandle.navigate(direction: 'next' | 'previous' | 'first')`.
- `navigate`: se uma nota da roda está focada, move a partir dela; se o foco está fora,
  `'next'`/`'previous'` apenas focam a nota selecionada por último, e `'first'` foca o C.
  O roving tabindex (um único tab stop) continua.
- O `onKeyDown` da nota trata só Enter (toca a nota). Setas, Home e Espaço deixam de ser
  tratados pela nota.

### `usePitchTracker`

- Estado ganha `deviceName: string | null`: o `label` da primeira trilha de áudio quando
  começa a ouvir (string vazia → `null`); `null` em `requesting`, `off` e `error`.

### `ExercisePlayer`

- Guarda um ref para o `PitchMeter` e chama `navigate` nas ações de nota.
- `REPEATABLE_ACTIONS` inclui `nextNote` e `previousNote`.
- Linha de status do microfone:
  - ouvindo: `🎙️ <deviceName>` ou `🎙️ Microfone ativo` se não houver nome;
  - desligado: `Mic desativado` (substitui "Microfone desligado");
  - pedindo acesso / erro: como hoje.

## Testes

- `keyboardShortcuts.test.ts`: novo mapa; foco por tipo de elemento (setas num botão →
  `nextNote`; Espaço numa nota da roda → `togglePlay`; setas/Home num slider → `null`).
- `PitchMeter.test.tsx`: `navigate` entra na roda sem avançar, gira com volta, `first` vai
  ao C; Enter numa nota chama `onNoteClick`; Espaço numa nota não chama.
- `usePitchTracker.test.ts`: `deviceName` = label da trilha; `null` quando desligado.
- `ExercisePlayer.test.tsx`: `+`/`-`/`=` e `,`/`.` mudam e param nos limites; setas focam
  e giram a roda; Espaço com nota focada pausa; "Mic desativado"; nome do mic exibido.

## Fora de escopo

Escolher outro microfone; detectar troca de dispositivo com o app aberto.
