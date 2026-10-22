# Várias entradas (uma roda por entrada) — Spec

## Contexto

O Marcelo percebeu que no Linux os "Monitor of …" aparecem como microfones e capturam o
som que sai do computador (p.ex. a voz de um vídeo do YouTube). Pediu para **adicionar as
entradas que quiser, cada uma com a sua roda**, para comparar a própria voz com a do
vídeo (ou outras vozes).

Decisões validadas:
- **Em todos os exercícios**: nos guiados, todas as rodas mostram a mesma nota-alvo.
- **Cada roda pontua sozinha**: cada entrada tem a sua pontuação (sessão e geral) e o
  histórico grava um registro por entrada.
- **A montagem fica salva**: quais entradas existem e qual dispositivo cada uma usa.

## Conceito: faixa (lane)

Uma **faixa** = uma entrada de áudio com: seletor de dispositivo, botão liga/desliga do
microfone, botão remover (exceto a primeira), roda cromática, onda e pontuação própria.

- A **primeira faixa** (id `primary`) é a de hoje: herda o mic salvo
  (`singer-trainer:mic-device-id`), não pode ser removida e, se o dispositivo dela sumir,
  cai no padrão do sistema (comportamento atual).
- **Faixas extras** (id aleatório): começam no primeiro dispositivo ainda não usado por
  outra faixa; se o dispositivo delas não estiver conectado, mostram "Entrada
  desconectada" (não caem no padrão, para não duplicar a primeira faixa).
- Botão **"+ Adicionar entrada"** abaixo das rodas.
- O nome da faixa é o nome do dispositivo (o rótulo do `<select>`).

## Layout

- Largo (≥ 900 px): coluna da esquerda como hoje (título, descrição, controles do
  exercício); à direita, as faixas em grade (`auto-fit`, mínimo ~260 px por faixa), cada
  uma num cartão com cabeçalho (🎙️ + seletor + liga/desliga + remover), roda e onda.
  Com uma faixa só, fica igual a hoje.
- Estreito: as faixas empilham.
- Os controles do exercício (play, som, velocidade, repetir, sensibilidade, ajuda)
  continuam globais. O seletor de mic e o 🔄 saem da coluna da esquerda e vão para o
  cartão de cada faixa (o 🔄 relê a lista para todas).

## Pontuação por faixa

- Mesmas regras de hoje, aplicadas a cada faixa com o próprio microfone e a nota-alvo
  comum.
- No fim de uma passada, grava um registro **por faixa** que teve tempo de alvo > 0.
- `ScoreRecord` ganha `inputId` e `inputLabel` (opcionais; registros antigos contam como
  da faixa `primary`).
- **Placar** (canto superior direito): uma linha por faixa —
  `nome | Sessão (tempo, %) | Geral (tempo, %)`, onde Geral = histórico daquela faixa
  (pelo `inputId`) + passada em andamento. Nome longo é truncado com reticências.
- **Histórico**: coluna "Entrada" nas últimas passadas; recordes por exercício e entrada.

## Teclado

- **M** liga/desliga o microfone da primeira faixa; as setas/Home/Enter navegam e tocam
  a roda da primeira faixa. (As outras faixas usam os próprios botões.)

## Persistência

- `singer-trainer:input-lanes`: lista `[{ id, deviceId }]` na ordem das faixas. Ausente
  → uma faixa `primary` com o mic salvo hoje (migração transparente).
- A sensibilidade do microfone continua global (vale para todas as faixas).

## Design

- `src/lib/inputLanes.ts`: `loadInputLanes`, `saveInputLanes`, `createLane(usedDeviceIds,
  available)`; o deviceId da faixa `primary` continua espelhado em `mic-device-id`.
- `usePitchTracker(sensitivity, enabled, deviceId, { fallbackToDefault })`: com
  `fallbackToDefault: false`, dispositivo ausente vira `status: 'error'` com mensagem
  "Entrada desconectada".
- `src/components/InputLane.tsx`: chama o `usePitchTracker` da faixa, renderiza o cartão
  (cabeçalho, `PitchMeter`, `Waveform`) e amostra a pontuação a cada 100 ms,
  reportando ao pai (`onSample(laneId, hit)`), quando ativa.
- `ExercisePlayer`: lista de faixas (estado + persistência), contagem da passada por
  faixa, gravação por faixa no fim da passada, ref da roda da primeira faixa para o
  teclado, M na primeira faixa.
- `ScoreBoard`: recebe linhas `{ laneId, label, session, overall }`.
- `ScoreHistory`: coluna "Entrada" e recordes por exercício + entrada.

## Testes

- `inputLanes`: migração, salvar/carregar, criar faixa com dispositivo livre.
- `usePitchTracker`: sem fallback → erro "Entrada desconectada".
- `scoreHistory`: `inputId` opcional, geral por faixa.
- `InputLane`: cartão, seletor, remover ausente na primária, "Entrada desconectada".
- `ExercisePlayer`: adicionar/remover faixa (persistido), duas faixas gravam dois
  registros no fim da passada, placar com uma linha por faixa, M afeta só a primeira.
- `ScoreBoard`/`ScoreHistory`: linhas por faixa, coluna "Entrada".

## Fora de escopo

Renomear faixas; sensibilidade por faixa; sincronizar/atrasar uma entrada em relação à
outra; alvo vindo de outra faixa (o exercício livre, a seguir, mede cada faixa contra a
nota mais próxima).
