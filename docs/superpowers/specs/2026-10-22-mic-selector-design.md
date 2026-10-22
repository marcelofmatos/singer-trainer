# Seletor de microfone — Spec

## Contexto

Na 1.3.x a linha de status mostra o nome do microfone em uso ("🎙️ Padrão"), mas não há
como trocar de microfone sem mexer nas configurações do sistema/navegador. O Marcelo
pediu um seletor.

Decisões validadas:
- **No lugar do nome do mic**: a linha "🎙️ <nome>" vira um dropdown com os microfones
  disponíveis (mesmo estilo do seletor de exercício). Desligado → "Mic desativado".
- **Lembrar a escolha** entre sessões (localStorage). Se o microfone salvo não estiver
  conectado, usa o padrão do sistema (a preferência salva continua, e volta a valer quando
  ele estiver conectado numa próxima abertura).
- **Hot-plug**: a lista se atualiza quando um microfone é conectado/desconectado; se o mic
  em uso for desconectado, reabre no padrão do sistema.
- **Botão 🔄 "Atualizar lista de microfones"** ao lado do dropdown: relê na hora os
  microfones que o sistema expõe (para quando um mic foi ativado nas configurações do
  sistema e não apareceu sozinho). Não troca o mic em uso.

## Comportamento

| Situação                                    | O que aparece                                        |
| ------------------------------------------- | ---------------------------------------------------- |
| Pedindo acesso                              | "Pedindo acesso ao microfone…" (como hoje)          |
| Ouvindo, lista de microfones disponível     | 🎙️ + dropdown "Microfone" com o dispositivo em uso   |
| Ouvindo, lista vazia (navegador sem suporte) | "🎙️ <nome>" ou "🎙️ Microfone ativo" (como hoje)      |
| Erro, lista disponível                      | mensagem de erro + dropdown (para tentar outro mic)  |
| Desligado (🎙️ ou M)                         | "Mic desativado"                                     |

- Escolher um item no dropdown reabre o microfone naquele dispositivo e salva a escolha.
- Opções sem nome (antes da permissão) aparecem como "Microfone 1", "Microfone 2"…
- O dropdown, quando focado, fica com todas as teclas (regra já existente para `select`).

## Design

### `src/lib/micPreference.ts` (novo)

`loadMicDeviceId(): string | null` e `saveMicDeviceId(id: string): void`, chave
`singer-trainer:mic-device-id`, no mesmo padrão de `lastExercise.ts` (tolerante a
localStorage indisponível).

### `src/hooks/useAudioInputs.ts` (novo)

`useAudioInputs(refreshKey: unknown): { inputs: AudioInput[]; refresh: () => void }` com
`AudioInput = { deviceId, label }` (`refresh` é o que o botão 🔄 chama):
lista `navigator.mediaDevices.enumerateDevices()` filtrando `kind === 'audioinput'`,
relê quando `refreshKey` muda (o player passa o `deviceId` em uso — os nomes só aparecem
depois da permissão) e no evento `devicechange`. Sem `mediaDevices` (contexto inseguro),
devolve `[]`.

### `usePitchTracker(sensitivity, enabled, deviceId = null)`

- Abre com `{ audio: { deviceId: { exact: deviceId } } }` quando há `deviceId`, senão
  `{ audio: true }`.
- Se o dispositivo pedido não existir (`OverconstrainedError` ou `NotFoundError`), tenta de
  novo com `{ audio: true }`.
- Estado ganha `deviceId: string | null` — o `deviceId` real da trilha
  (`track.getSettings().deviceId`), `null` fora de `listening`.
- Quando a trilha termina (`ended`, p.ex. o mic foi desconectado), reabre o microfone
  (com o fallback acima, cai no padrão).
- O efeito passa a depender de `[enabled, deviceId, <contador de reabertura>]`.

### `ExercisePlayer`

- Estado `preferredMicId` (inicial `loadMicDeviceId()`), passado ao `usePitchTracker`.
- `useAudioInputs(pitchTracker.deviceId)`.
- Dropdown `<select aria-label="Microfone" className="mic-select">` dentro de
  `<label className="mic-picker">` com o 🎙️; valor = `pitchTracker.deviceId ??
  preferredMicId ?? ''`; ao mudar: `setPreferredMicId` + `saveMicDeviceId`.
- Botão `icon-button` 🔄 com `aria-label="Atualizar lista de microfones"` ao lado do
  dropdown, chamando `refresh`.

## Testes

- `micPreference.test.ts`: espelha `lastExercise.test.ts`.
- `useAudioInputs.test.ts`: filtra `audioinput`, nomeia sem label, relê no `devicechange`
  e quando `refreshKey` muda, relê ao chamar `refresh`, `[]` sem `mediaDevices`.
- `usePitchTracker.test.ts`: constraint `exact` com `deviceId`; fallback para o padrão em
  `OverconstrainedError`; `deviceId` real exposto; reabre quando a trilha termina.
- `ExercisePlayer.test.tsx`: lista os microfones; trocar reabre com o `deviceId` escolhido
  e salva; abre com o salvo; o botão 🔄 mostra um mic conectado depois; "Mic desativado"
  quando desligado.

## Fora de escopo

Seletor de saída de áudio; teste de nível do microfone; atalho de teclado para trocar mic.
