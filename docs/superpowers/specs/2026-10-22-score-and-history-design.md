# Pontuação e histórico — Spec

## Contexto

O Marcelo pediu um placar no canto superior direito para medir **quanto tempo está
acertando as notas** e a **porcentagem de acerto**, gravado no navegador para ter um
**histórico**.

Decisões validadas:
- **Acerto = verde**: a nota cantada está a até **±10 cents** da nota-alvo (mesmo
  critério da cor verde do indicador).
- **Qualquer oitava** conta (a roda já ignora a oitava; vozes graves cantam uma oitava
  abaixo).
- **Um registro por passada completa**: cada vez que o exercício chega ao fim (no modo
  Repetir, cada volta). Passada interrompida (troca de exercício, de velocidade) não é
  gravada.
- **Histórico em painel** aberto pelo placar (ou tecla **H**): últimas pontuações e o
  recorde de cada exercício.
- **Duas pontuações no placar, somando todos os exercícios**:
  - **Sessão**: desde que a página foi aberta — passadas completas desta sessão + a
    passada em andamento (ao vivo).
  - **Geral**: todo o histórico gravado + a passada em andamento (ao vivo).

## Regras de contagem

- O tempo conta só enquanto: o exercício está tocando (não pausado, não terminado), há
  nota-alvo naquele instante e o microfone está ouvindo (`status === 'listening'`).
- A cada tick de 100 ms nessas condições: soma 0,1 s ao **tempo de alvo**; se a nota
  detectada for acerto, soma 0,1 s também ao **tempo afinado**. Silêncio conta como erro.
- **% de acerto** = tempo afinado / tempo de alvo, arredondado para inteiro (0 se não
  houve tempo de alvo).
- A passada em andamento entra ao vivo nos dois placares. Quando ela termina e é gravada,
  passa a fazer parte da sessão e do histórico (sem contar em dobro). Uma passada
  interrompida some dos placares, porque não é gravada.
- Passada com tempo de alvo 0 (p.ex. microfone desligado o tempo todo) não é gravada.
- Tempo exibido: abaixo de 1 minuto "48,2 s"; a partir de 1 minuto "12 min 05 s".

## Placar (canto superior direito)

Botão compacto no canto superior direito da página:

```
          SESSÃO   GERAL
Afinado   48,2 s   12 min 05 s
Acerto    71%      64%
```

- `aria-label="Pontuação — abrir histórico"`; clicar abre o painel.
- Em telas estreitas (< 900 px, layout de uma coluna) deixa de flutuar e aparece no fluxo, centralizado, acima
  do título do exercício.

## Histórico

- Gravado em `localStorage` (chave `singer-trainer:score-history`), no máximo 500
  registros (descarta os mais antigos).
- Registro: `exerciseId`, `exerciseName`, `finishedAt` (epoch ms), `playbackRate`,
  `targetSeconds`, `hitSeconds`.
- Painel (`<dialog>` nativo, como o de atalhos), título "Histórico de pontuação":
  - **Recordes**: melhor % por exercício.
  - **Últimas passadas** (as 50 mais recentes, mais nova primeiro): data/hora, exercício,
    tempo afinado, % de acerto.
  - Sem registros: "Nenhuma passada completa ainda."
  - Botão "Fechar"; Esc fecha.
- Tecla **H** abre o painel (entra no mapa de atalhos e na ajuda). Com qualquer painel
  aberto, os atalhos globais ficam desligados.

## Design

- `src/lib/scoring.ts` (puro): `isHit(detected, targetMidi)` (oitava ignorada, ±10 cents),
  `ScoreTally { targetSeconds, hitSeconds }`, `EMPTY_TALLY`, `addSample`, `addTallies`,
  `hitPercent`, `formatSeconds` ("48,2 s" / "12 min 05 s").
- `src/lib/scoreHistory.ts`: `loadScoreHistory`, `appendScoreRecord`,
  `bestPercentByExercise`, `totalTally` (soma do histórico) — tolerante a localStorage
  indisponível/corrompido.
- `src/components/ScoreBoard.tsx` e `src/components/ScoreHistory.tsx` (apresentação).
- `ExercisePlayer`: amostra a cada 100 ms via refs na contagem da passada, zera quando
  uma passada começa e, quando ela chega ao fim, grava no histórico e soma na contagem
  da sessão; placar = sessão + passada, e histórico total + passada; estado do painel;
  ação `showHistory` (tecla H).

## Testes

- `scoring.test.ts`: acerto na oitava exata e em outras oitavas, limite de ±10 cents,
  sem nota/sem alvo; soma e % (incluindo 0).
- `scoreHistory.test.ts`: vazio, append + load, limite de 500, dados corrompidos,
  recorde por exercício.
- `ScoreBoard.test.tsx` / `ScoreHistory.test.tsx`: colunas sessão/geral, abrir/fechar,
  lista vazia, ordenação, recordes.
- `ExercisePlayer.scoring.test.tsx` (tracker mockado): cantar a nota certa por uma
  passada inteira grava 100% e soma na sessão e no geral sem contar em dobro; silêncio
  grava 0%; pausar não conta tempo; o geral inclui o histórico anterior; H abre o painel.

## Fora de escopo

Apagar/exportar histórico, gráficos de evolução, pontuação por nota.
