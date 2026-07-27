# singer-trainer

App pessoal de treinamento de canto com feedback visual de afinação em tempo real. Uma
roda cromática mostra as 12 notas em ordem de altura do som (como um relógio), com um
indicador que desliza suavemente conforme você canta e destaca a nota-alvo do exercício.

Não requer conhecimento prévio de teoria musical — a posição no círculo já comunica o
quão perto você está da nota certa.

## Funcionalidades

- **Feedback de afinação em tempo real** — detecção de pitch (algoritmo YIN) rodando
  100% no navegador, sem servidor.
- **Exercícios prontos** — escala maior, sirene, lip trill, respiração sustentada.
- **Controle de velocidade e repetição** do exercício, com preferências salvas
  localmente.
- **Bolhas clicáveis** — toque em qualquer nota da roda pra ouvir como ela soa.
- Página única com menu de abas — trocar de exercício não pede acesso ao microfone de
  novo.

## Rodando localmente

```bash
cd frontend
npm install
npm run dev
```

Testes:

```bash
npm test
```

## Docker

```bash
cd frontend
./release-and-build.sh 0.1.0   # builda e versiona a imagem (SemVer + latest)
```

A stack de deploy (compose, variáveis de ambiente, proxy) fica fora deste repositório,
num diretório de infraestrutura separado.

## Arquitetura e decisões de design

O histórico completo de especificações e planos de implementação está em
[`docs/superpowers/specs/`](docs/superpowers/specs/) e
[`docs/superpowers/plans/`](docs/superpowers/plans/).

## Fora de escopo (por enquanto)

Gravação de tentativas, histórico de evolução entre sessões e organização de repertório
não fazem parte desta primeira fatia do app.
