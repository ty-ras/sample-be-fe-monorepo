#!/bin/sh

set -e

TYRAS_ROOT_DIR="$(pwd)"
echo "TYRAS_ROOT_DIR=${TYRAS_ROOT_DIR}
TYRAS_NODE_VERSION_BE=$(cat "${TYRAS_ROOT_DIR}/backend/build-versions/node")-alpine
TYRAS_NODE_VERSION_FE=$(cat "${TYRAS_ROOT_DIR}/frontend/build-versions/node")-alpine
TYRAS_NODEMON_ARGS=$@
" > "${TYRAS_ROOT_DIR}/environment/.env"

echo '// This file is auto-generated, modifications will be overwritten!
const config = {
  auth: {
    endpoint: "http://localhost:4000",
    clientId: "abcdefghijklmnopqrstuvwxy",
  },
  region: undefined,
  backend: "http://localhost:4001",
} as const;

export default config;' > "${TYRAS_ROOT_DIR}/frontend/src/environment.ts"

mkdir -p "${TYRAS_ROOT_DIR}/environment/.data/auth/db"
# We have to copy files 1-by-1 as `cp` behaves slightly differently on Mac and Linux
cp "${TYRAS_ROOT_DIR}/environment/auth/config.json" "${TYRAS_ROOT_DIR}/environment/.data/auth"
cp "${TYRAS_ROOT_DIR}/environment/auth/db/clients.json" "${TYRAS_ROOT_DIR}/environment/.data/auth/db"
cp "${TYRAS_ROOT_DIR}/environment/auth/db/local_abcdefgh.json" "${TYRAS_ROOT_DIR}/environment/.data/auth/db"

docker compose \
  --project-name tyras-be-and-fe \
  --file environment/docker-compose.yml \
  down

docker compose \
  --project-name tyras-be-and-fe \
  --file environment/docker-compose.yml \
  up \
  --abort-on-container-exit