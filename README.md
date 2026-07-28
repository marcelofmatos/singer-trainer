# singer-trainer

App pessoal de treinamento de canto com feedback visual de afinação em tempo real. Uma
roda cromática mostra as 12 notas em ordem de altura do som (como um relógio), com um
indicador que desliza suavemente conforme você canta e destaca a nota-alvo do exercício.

Não requer conhecimento prévio de teoria musical — a posição no círculo já comunica o
quão perto você está da nota certa.

## Funcionalidades

- **Feedback de afinação em tempo real** — detecção de pitch (algoritmo YIN) rodando
  100% no navegador, sem servidor.
- **Exercícios prontos** — escala maior, sirene, lip trill, respiração sustentada,
  arpejo maior, escala de 5 notas, saltos de oitava.
- **Play/pause e mudo** — pausar congela o tom de referência e o indicador de afinação
  exatamente onde estavam, sem reiniciar o exercício.
- **Controle de velocidade e repetição** do exercício, com preferências salvas
  localmente.
- **Sensibilidade do microfone ajustável** — calibra o quão exigente a detecção de pitch
  é ao aceitar um som como nota certa.
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

Build local (dev/teste, sem publicar):

```bash
docker build -t singer-trainer:dev frontend
```

**Release**: as imagens são versionadas em SemVer (`x.y.z`) mais `latest`, publicadas no
GHCR pelo workflow **Release and build** do GitHub Actions
([`.github/workflows/release-and-build.yml`](.github/workflows/release-and-build.yml)) —
Actions → *Release and build* → Run workflow → `patch` / `minor` / `major`. Cada execução
cria a tag, o release no GitHub e publica:

```
ghcr.io/marcelofmatos/singer-trainer:<x.y.z>
ghcr.io/marcelofmatos/singer-trainer:<x.y>
ghcr.io/marcelofmatos/singer-trainer:<x>
ghcr.io/marcelofmatos/singer-trainer:latest
```

Versões já publicadas nunca são sobrescritas — uma correção ou feature nova é sempre uma
versão nova (SemVer).

A stack de deploy (compose, variáveis de ambiente, proxy) fica fora deste repositório,
num diretório de infraestrutura separado.

## Arquitetura e decisões de design

O histórico completo de especificações e planos de implementação está em
[`docs/superpowers/specs/`](docs/superpowers/specs/) e
[`docs/superpowers/plans/`](docs/superpowers/plans/).

## Fora de escopo (por enquanto)

Gravação de tentativas, histórico de evolução entre sessões e organização de repertório
não fazem parte desta primeira fatia do app.
