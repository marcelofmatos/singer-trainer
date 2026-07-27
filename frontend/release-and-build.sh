#!/usr/bin/env bash
# Builds the singer-trainer-frontend Docker image tagged with a SemVer version
# and updates `latest` in the same build, per the project's versioning policy:
# old version tags are never overwritten, so rollback stays possible by pinning
# IMAGE_TAG to a previous version in the stack's .env.
set -euo pipefail

IMAGE_NAME="singer-trainer-frontend"
VERSION="${1:?Uso: ./release-and-build.sh <versao-semver>, ex.: ./release-and-build.sh 0.1.0}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Erro: versão '$VERSION' não está no formato SemVer (x.y.z)." >&2
  exit 1
fi

if docker image inspect "${IMAGE_NAME}:${VERSION}" >/dev/null 2>&1; then
  echo "Erro: a tag ${IMAGE_NAME}:${VERSION} já existe — versões já publicadas não são sobrescritas. Use uma versão nova." >&2
  exit 1
fi

cd "$(dirname "$0")"

docker build -t "${IMAGE_NAME}:${VERSION}" -t "${IMAGE_NAME}:latest" .

echo "Build concluído: ${IMAGE_NAME}:${VERSION} e ${IMAGE_NAME}:latest"
