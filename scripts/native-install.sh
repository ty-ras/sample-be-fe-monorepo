#!/bin/sh

yarn install "$@"

if [ -f "${TYRAS_LIB_DIR}/config.own" ]; then
  TYRAS_LIB_TSCONFIG_NAME='tsconfig.library.json'
  TYRAS_LIB_ESLINTRC_NAME='.eslintrc.library.cjs'
else
  TYRAS_LIB_TSCONFIG_NAME='tsconfig.json'
  TYRAS_LIB_ESLINTRC_NAME='.eslintrc.cjs'
fi

cp .eslintrc.library.cjs "${TYRAS_LIB_DIR}/${TYRAS_LIB_ESLINTRC_NAME}"
cp tsconfig.library.json "${TYRAS_LIB_DIR}/${TYRAS_LIB_TSCONFIG_NAME}"
cp tsconfig.build.json "${TYRAS_LIB_DIR}"
