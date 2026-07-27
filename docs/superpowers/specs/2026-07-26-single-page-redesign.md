# Página única com abas, controles de velocidade/repetição e redesign visual — Spec

## Contexto

O Marcelo gostou da roda cromática e do indicador ao vivo, mas achou a página ao
redor (lista vertical de botões escuros, título apagado, fundo branco sem
identidade) sem acabamento. Ele pediu três coisas:

1. Os botões de exercício virarem um **menu horizontal em cima**, com tudo numa
   **página única** (sem navegar pra outra tela ao escolher um exercício).
2. Uma **melhora geral no design** da página — pesquisa feita sobre apps de
   música/canto modernos (Yousician, Simply Piano) e sobre tendências de
   dashboards 2026 confirma: modo escuro por padrão, navegação simples,
   componentes limpos. Direção aprovada: **"Estúdio à noite"** — fundo escuro
   quente, brilho radial suave atrás da roda (como um holofote), tipografia com
   personalidade (serifado Fraunces nos títulos + Manrope no corpo), abas em
   formato de pílula.
3. **Controle de velocidade** do exercício e uma **opção de repetir em loop**.

Além disso, o Marcelo pediu explicitamente **testes que protejam a roda
cromática e o indicador ao vivo de regressão** durante essa mudança.

## Decisões de design

### Layout (página única, abas)

- `App.tsx` mantém sempre montado o `ExercisePlayer` do exercício ativo — não
  existe mais uma "tela de escolha" separada da "tela de prática". O menu de
  abas fica sempre visível no topo; trocar de aba só troca `exercise` como prop.
- Benefício colateral: como `usePitchTracker` só pede o microfone uma vez (seu
  efeito não depende de `exercise`), trocar de aba **não pede permissão de
  microfone de novo** — só a melodia de referência e a nota-alvo mudam.
- O botão "Voltar" deixa de existir (não há mais de onde "voltar").

### Velocidade e loop

- Um controle deslizante (`<input type="range">`) ajusta um multiplicador de
  velocidade (0.5x a 2x, passo de 0.25) que **encolhe ou estica os tempos das
  notas do exercício** (não muda o pitch, só a duração/tempo de cada nota) —
  nova função pura `scaleExerciseTiming(exercise, rate)`.
- Um checkbox "Repetir" reinicia o exercício automaticamente ao terminar,
  enquanto estiver marcado. Ligar/desligar o loop **não interrompe** a
  execução em andamento — só decide se, quando a execução atual terminar, uma
  nova começa.
- Falha ao criar o `AudioContext` do tom de referência (ex.: ambiente sem
  suporte a Web Audio) agora é tratada como um estado de erro visível, em vez
  de quebrar o componente — isso também é o que permite testar `ExercisePlayer`
  dentro de `App.test.tsx` sem precisar simular a Web Audio API.

### Visual ("Estúdio à noite")

- Paleta: fundo grafite quente (`#14110f`), texto quase-branco quente, acento
  âmbar (`#e8a33d`) para estados ativos — paleta neutra de propósito, pra não
  competir com o arco-íris já usado nas 12 bolhas da roda.
- Tipografia: `Fraunces Variable` (títulos, via pacote `@fontsource-variable`,
  ou seja, sem depender de CDN externo em tempo de execução) + `Manrope
  Variable` (corpo).
- Um brilho radial suave (`radial-gradient`) atrás da roda cromática, pra dar
  efeito de "holofote".
- Abas em formato de pílula, com destaque âmbar na aba ativa.

## Proteção contra regressão da roda/indicador

- **`frontend/src/lib/chromaticWheel.ts` e `frontend/src/components/
  PitchMeter.tsx` não são tocados por esta mudança** — nenhuma task deste plano
  os modifica. Os 51 testes já existentes (15 de geometria/cor + 8 do
  componente) continuam sendo a rede de segurança para esse comportamento.
- Novo teste em `App.test.tsx` confirma que, dentro da página única
  reformulada, a roda cromática (as 12 bolhas) continua realmente montada e
  visível para o exercício ativo — uma proteção de integração que não existia
  antes (o teste anterior nunca chegava a montar o `ExercisePlayer`).
- O indicador ao vivo (`live-indicator`) continua sem poder ser testado via
  microfone real em jsdom (limitação de ambiente, não deste projeto) — sua
  proteção de regressão já está em `PitchMeter.test.tsx`, testado diretamente
  por props, sem depender do microfone. Este plano não reduz essa cobertura.

## Fora de escopo

- Persistência da velocidade/loop escolhidos entre sessões (por enquanto,
  reseta ao trocar de aba ou recarregar a página).
- Qualquer mudança em gravação, histórico ou repertório (continuam fora do
  MVP).
