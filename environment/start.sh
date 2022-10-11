#!/bin/sh

TYRAS_ROOT_DIR="$(pwd)"
echo "TYRAS_ROOT_DIR=${TYRAS_ROOT_DIR}
NODE_VERSION_BE=$(cat "${TYRAS_ROOT_DIR}/backend/build-versions/node")-alpine
" > "${TYRAS_ROOT_DIR}/environment/.env"

docker compose \
  --project-name tyras-be-and-fe \
  --file environment/docker-compose.yml \
  down

docker compose \
  --project-name tyras-be-and-fe \
  --file environment/docker-compose.yml \
  up \
  --abort-on-container-exit