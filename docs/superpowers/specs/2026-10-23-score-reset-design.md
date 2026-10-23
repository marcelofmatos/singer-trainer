# Reset das pontuações e fechar o histórico clicando fora — Spec

## Contexto

O Marcelo pediu um botão de reset das pontuações e que o modal do histórico feche ao clicar
fora dele. Decisões validadas: **dois botões** (zerar a sessão / apagar o histórico) e
**confirmação por segundo clique** (sem diálogo do navegador).

## Comportamento

- No rodapé do modal "Histórico de pontuação", ao lado de "Fechar":
  - **"Zerar sessão"**: zera a coluna Sessão do placar de todas as entradas, inclusive a
    passada em andamento. O histórico gravado não muda.
  - **"Apagar histórico"**: apaga o histórico gravado no navegador (recordes, últimas
    passadas, acerto por nota e a coluna Geral). A sessão não muda.
- Confirmação: o 1º clique troca o texto do botão para "Confirmar: zerar sessão?" /
  "Confirmar: apagar histórico?"; o 2º clique executa e o botão volta ao texto original.
  Fechar o modal desarma a confirmação.
- Clicar no fundo escurecido fora do modal fecha o modal (como Esc e "Fechar"). Clicar dentro
  do modal, inclusive nas bordas internas, não fecha.

## Design

- `scoreHistory.ts`: `clearScoreHistory()` remove a chave do localStorage.
- `ScoreHistory`: props `onResetSession` e `onClearHistory`; estado do botão armado; o
  conteúdo vai num `div.app-dialog-body` com o padding, e o `<dialog>` fica sem padding,
  para que um clique cujo alvo é o próprio `<dialog>` só possa ser no fundo.
- `ExercisePlayer`: `onResetSession` limpa as somas da sessão e da passada em andamento;
  `onClearHistory` chama `clearScoreHistory()` e esvazia o histórico em memória.

## Testes

- `scoreHistory`: `clearScoreHistory` deixa `loadScoreHistory()` vazio.
- `ScoreHistory`: 1º clique só arma (texto de confirmação, sem callback); 2º chama o
  callback; fechar desarma; clique no `<dialog>` chama `onClose`; clique no conteúdo não.
- `ExercisePlayer`: após uma passada, "Zerar sessão" zera a sessão e mantém o geral;
  "Apagar histórico" zera o geral, limpa o localStorage e mantém a sessão.
