#!/bin/sh

. 'scripts/preamble.sh'

yarn install "$@"

cp .eslintrc.library.cjs "${TYRAS_LIB_DIR}/.eslintrc.cjs"
if [[ "$(echo "${TYRAS_LIB_DIR}" | cut -c1-8)" != 'frontend' ]]; then
  # Frontend is special and has its own tsconfig.
  cp tsconfig.library.json "${TYRAS_LIB_DIR}/tsconfig.json"
  cp tsconfig.build.json "${TYRAS_LIB_DIR}"
fi
