# Controles e navegação pelo teclado — Spec

## Contexto

O Marcelo pediu controles e navegação pelo teclado. Hoje o app já funciona com Tab nos
botões, sliders e no seletor de exercício, e cada uma das 12 notas da roda é um tab stop
separado (Enter/Espaço tocam a nota). Não há atalhos globais nem como ligar/desligar o
microfone.

Decisões validadas com o Marcelo (brainstorm):
- **Atalhos globais** para reprodução, som, loop, velocidade, sensibilidade, troca de
  exercício, ajuda — e **ligar/desligar o microfone** (feature nova).
- **Microfone desligado libera o stream** (o ícone de gravação do navegador some); ao
  religar, reabre o mic.
- **Mapa de teclas**: S = som, M = microfone (ver tabela).
- **Roda com um único tab stop** (roving tabindex) e setas para girar entre as notas.
- **Ajuda** com `?` e um botão ⌨️ visível.
- Sem dependência nova: mapa de teclas puro + um listener de `keydown`.

## Mapa de atalhos

| Tecla              | Ação                                                        |
| ------------------ | ----------------------------------------------------------- |
| Espaço             | Play / pausar / reiniciar (mesmo efeito do botão ▶/⏸)        |
| S                  | Silenciar / ativar o som da referência                      |
| M                  | Ligar / desligar o microfone                                |
| R                  | Liga / desliga "Repetir"                                    |
| ← / →              | Velocidade − / + (um passo do slider: 0,25x)                |
| ↓ / ↑              | Sensibilidade do microfone − / + (um passo: 0,05)           |
| PageUp ou `[`      | Exercício anterior                                          |
| PageDown ou `]`    | Próximo exercício                                           |
| `?`                | Abre o painel de ajuda com esta tabela                      |

Letras valem em minúscula e maiúscula (Caps Lock ligado não quebra os atalhos).

### Quando os atalhos globais NÃO disparam

- Foco num elemento que já trata essas teclas: `button`, `input`, `select`, `textarea`,
  ou qualquer elemento com `role="button"` (inclui as notas da roda). Ex.: Espaço num
  botão focado só clica o botão; setas num slider focado só mexem nele.
- Com Ctrl, Alt ou Meta pressionados (não roubar atalhos do navegador/SO). Shift é
  permitido (necessário para `?`).
- Com o painel de ajuda aberto.

Quando um atalho dispara, o evento recebe `preventDefault()` (evita, p.ex., Espaço/setas
rolarem a página).

### Limites

- Velocidade e sensibilidade param nos limites do slider (0,5–2x e 0,05–0,35); não dão
  a volta. Os valores continuam persistidos nas preferências, como hoje.
- Troca de exercício dá a volta: PageDown no último vai para o primeiro, PageUp no
  primeiro vai para o último. O exercício escolhido continua persistido como hoje.

## Design

### `src/lib/keyboardShortcuts.ts` (novo, puro)

```ts
export type ShortcutAction =
  | 'togglePlay' | 'toggleMute' | 'toggleMic' | 'toggleLoop'
  | 'slower' | 'faster' | 'lessSensitive' | 'moreSensitive'
  | 'previousExercise' | 'nextExercise' | 'showHelp';

export function resolveShortcut(event: {
  key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean; target: EventTarget | null;
}): ShortcutAction | null;
```

Retorna `null` para teclas não mapeadas, modificadores proibidos ou alvo interativo
(regras acima). Exporta também a lista de atalhos (tecla exibida + descrição) usada pelo
painel de ajuda, para a tabela não divergir do mapa.

### `usePitchTracker(sensitivity, enabled = true)`

- Novo parâmetro `enabled`. O efeito que abre o mic passa a depender de `enabled`:
  `true` → abre (como hoje); `false` → não abre, e a limpeza do efeito anterior para as
  tracks, o intervalo e fecha o `AudioContext`.
- Novo status `'off'`: com `enabled = false`, o estado é
  `{ status: 'off', errorMessage: null, currentNote: null, waveform: [] }`.
- Religar volta para `'requesting'` → `'listening'` (ou `'error'`).

### `ExercisePlayer`

- Novas props: `onPreviousExercise`, `onNextExercise` (o `App` calcula com volta).
- Novo estado `micEnabled` (começa `true`, não persistido) e botão 🎙️ nos controles com
  `aria-pressed={!micEnabled}` e `aria-label` "Desligar microfone" / "Ligar microfone".
- Com mic `'off'`: roda e onda recebem `detectedNote = null` (estado "sem sinal") e
  aparece `<p className="status-message">Microfone desligado</p>`.
- Um `useEffect` registra `keydown` no `document`, chama `resolveShortcut` e executa a
  ação (via ref para sempre ver o estado atual sem re-registrar a cada render).
- Botão ⌨️ (`aria-label="Atalhos de teclado"`) abre o painel de ajuda.

### `PitchMeter` — roving tabindex

- Apenas uma nota tem `tabIndex=0` (a última focada; inicialmente C); as demais `-1`.
- Com foco numa nota: → e ↓ vão para a próxima no sentido horário, ← e ↑ para a anterior
  (com volta B↔C), Home vai para C. O foco acompanha. Enter/Espaço tocam a nota (como hoje).

### `KeyboardHelp` (novo componente)

- `<dialog>` nativo aberto com `showModal()` (foco preso e Esc nativos), título
  "Atalhos de teclado", tabela gerada da lista exportada por `keyboardShortcuts.ts` e
  botão "Fechar".

### `App`

- Passa `onPreviousExercise`/`onNextExercise` ao `ExercisePlayer`, calculando o índice
  com volta sobre `BUILTIN_EXERCISES`.

## Testes

- `keyboardShortcuts.test.ts`: cada tecla → ação; maiúsculas; Ctrl/Alt/Meta → `null`;
  alvos `button`/`input`/`select`/`textarea`/`role="button"` → `null`; tecla não
  mapeada → `null`.
- `ExercisePlayer.test.tsx`: Espaço pausa/retoma; S alterna o mudo; R alterna o loop;
  setas mudam velocidade/sensibilidade e param no limite; M desliga o mic (tracks do
  mock de `getUserMedia` paradas, status "Microfone desligado") e religa (novo
  `getUserMedia`); botão 🎙️ faz o mesmo; atalho ignorado com foco num slider; `?` e ⌨️
  abrem a ajuda.
- `App.test.tsx`: PageDown/`]` vão para o próximo exercício e dão a volta; PageUp/`[`
  para o anterior.
- `PitchMeter.test.tsx`: só uma nota com `tabIndex=0`; setas e Home movem o foco com volta.
- O jsdom 25 não implementa `HTMLDialogElement.showModal/close`: os testes stubam esses
  métodos (alternando o atributo `open`) no setup dos testes que abrem a ajuda.
- Conferência visual no navegador (botões novos e painel de ajuda).

## Fora de escopo

- Tocar notas pelo teclado estilo piano.
- Personalizar as teclas.
- Persistir o estado do microfone entre sessões.
