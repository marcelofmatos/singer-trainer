# Exercício livre — Spec

Depende de "Pontuação e histórico" (`2026-10-22-score-and-history-design.md`).

## Contexto

O Marcelo quer um **exercício livre** para treinar cada nota cantando junto com as
músicas dele.

Decisões validadas:
- **Música em outra aba** (YouTube etc.): o app só escuta o microfone. (Recomenda-se
  fone de ouvido para o microfone não captar a música.)
- **Alvo = nota mais próxima** (modo afinador): não há nota-alvo; o indicador mede contra
  a nota mais próxima do que está sendo cantado.
- **Conta para a pontuação**: o tempo só corre **enquanto há voz detectada** (o silêncio
  entre frases não conta como erro); acerto = até ±10 cents da nota mais próxima. Um
  registro é gravado **ao sair**: trocar de exercício, pausar ou fechar/ocultar a página.
- **% por nota**: durante o livre, cada nota da roda mostra a % de acerto daquela nota;
  o registro guarda o detalhe por nota.

## Comportamento

- Novo item no seletor: **"Exercício livre"** (id `livre`), com descrição explicando o
  uso com música em outra aba e a sugestão do fone.
- Sem som de referência e sem nota-alvo. A roda não destaca alvo; o indicador continua
  colorido pela afinação em relação à nota mais próxima (comportamento atual quando não
  há alvo).
- Controles: ficam **Play/pausa** (pausa a contagem e grava o trecho), microfone,
  seletor de mic, sensibilidade e ajuda. Somem: som de referência, velocidade e repetir
  (não se aplicam).
- **% por nota na roda**: abaixo do nome de cada nota aparece a % de acerto daquela nota
  no trecho atual (vazio enquanto a nota não foi cantada).
- **Placar**: o trecho em andamento entra ao vivo na sessão e no geral, como uma passada.
- **Histórico**: registros do livre aparecem como "Exercício livre". O painel ganha a
  seção **"Exercício livre — acerto por nota"**, com a % de cada nota somando todos os
  registros do livre.

## Regras de contagem (livre)

- A cada tick de 100 ms, se estiver tocando (não pausado), o microfone estiver ouvindo e
  houver nota detectada: soma 0,1 s ao tempo de alvo; se `|cents| ≤ 10` em relação à nota
  mais próxima, soma 0,1 s ao tempo afinado; o mesmo vai para o contador da classe de
  altura (C…B) da nota detectada.
- Gravação do trecho (se tiver tempo de alvo > 0): ao pausar, ao trocar de exercício, ao
  ocultar/fechar a página (`visibilitychange` → hidden / `pagehide`). Depois de gravar, o
  trecho zera.

## Design

- `exercises.ts`: `Exercise` ganha `mode?: 'free'`; novo `FREE_EXERCISE` em
  `BUILTIN_EXERCISES` (sem notas).
- `scoring.ts`: `isHitNearest(detected)` (±10 cents da nota mais próxima) e
  `NoteTallies = ScoreTally[12]` com `addNoteSample`.
- `scoreHistory.ts`: `ScoreRecord` ganha `noteTallies?: ScoreTally[]` (validado se
  presente); `freeNotePercents(history)` agrega por nota os registros do livre.
- `PitchMeter`: prop opcional `notePercents?: (number | null)[]` (12 posições) renderizada
  em texto pequeno dentro da bolha, abaixo do nome.
- `ExercisePlayer`: no modo livre não toca referência nem roda o relógio do exercício;
  amostra a pontuação livre; grava nos gatilhos acima; esconde os controles que não se
  aplicam.
- `ScoreHistory`: seção "Exercício livre — acerto por nota".

## Testes

- `scoring`: `isHitNearest`, `addNoteSample`.
- `scoreHistory`: `noteTallies` opcional válido/inválido; `freeNotePercents`.
- `PitchMeter`: renderiza as % quando a prop vem; nada quando não vem.
- `ExercisePlayer` (tracker mockado): no livre, voz afinada conta, silêncio não conta;
  pausar grava o trecho com `noteTallies`; trocar de exercício grava; ocultar a página
  grava; não toca som de referência; controles de velocidade/repetir/som ausentes.
- `ScoreHistory`: seção por nota.

## Fora de escopo

Tocar arquivos de áudio no app; detectar a tonalidade da música; alvo escolhido na roda.
