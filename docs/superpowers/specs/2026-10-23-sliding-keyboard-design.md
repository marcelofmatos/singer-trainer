# Teclado deslizante com a nota no centro — Spec

Revisão do modo **Teclado** de `2026-10-23-visualization-modes-design.md` (versão 1.7.x).

## Contexto

O Marcelo gostou das visualizações e pediu para o teclado:
1. **Mostrar todas as notas, deslizando para os lados** conforme a escala anda (em vez
   de duas oitavas fixas).
2. **Mostrar a nota no meio**, como o centro da roda.

Decisões validadas:
- Teclado com **toda a extensão vocal, C2 a C6** (49 teclas), mostrando ~2 oitavas por
  vez e **deslizando sozinho**.
- O teclado **centraliza na nota-alvo**; sem alvo (p.ex. exercício livre), centraliza
  na nota cantada.

## Comportamento

- Faixa total: C2 (MIDI 36) a C6 (MIDI 84). Janela visível: 14 teclas brancas (~2
  oitavas). A janela desliza com transição suave (~250 ms) para manter a **nota de
  foco** no centro, sem passar das pontas (nas pontas o teclado encosta na borda).
- Nota de foco, em ordem de prioridade:
  1. a tecla focada pelo teclado do computador (setas), enquanto o teclado tiver foco;
  2. a nota-alvo;
  3. a nota cantada;
  4. a última nota de foco (inicialmente C4) — o teclado não volta ao início no silêncio.
- **Nota no centro**, acima do teclado e centralizada (como o centro da roda): nota +
  oitava da voz (ex.: "A#4"), grande, na cor da afinação; vazio no silêncio; 🎤🚫 quando
  o microfone falha. O desvio em cents ("+12 ¢") fica pequeno, logo abaixo.
- Mantém: tecla-alvo contornada (contorno desenhado por cima), tecla cantada acesa na cor
  da afinação, clique/Enter tocam a nota da tecla, setas/Home navegam (Home → C4).
- Voz fora de C2–C6: seta na borda ("◀ G1" / "D6 ▶") como hoje.
- O `keyboardLowMidi` calculado pelo player deixa de existir.

## Testes

- 49 teclas de C2 a C6.
- Deslocamento (`data-offset`, em % da largura do teclado): centraliza a nota-alvo;
  sem alvo, a cantada; sem nenhuma, mantém a última; encosta nas pontas (C2 e C6).
- Nota central: "A#4" na cor da afinação; vazia no silêncio; 🎤🚫 com erro.
- Navegação: setas andam pelas 49 teclas e a janela segue a tecla focada; Home → C4.
- Tecla-alvo, tecla acesa, clique e seta fora da faixa como antes.
