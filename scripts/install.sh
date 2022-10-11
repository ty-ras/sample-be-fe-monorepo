#!/bin/sh

. 'scripts/preamble.sh'

yarn install "$@"

cp .eslintrc.library.cjs "${TYRAS_LIB_DIR}/.eslintrc.cjs"
cp tsconfig.library.json "${TYRAS_LIB_DIR}/tsconfig.json"
cp tsconfig.build.json "${TYRAS_LIB_DIR}"
cp .gitignore.library "${TYRAS_LIB_DIR}/.gitignore"