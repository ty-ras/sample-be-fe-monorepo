#!/bin/sh

. 'scripts/preamble.sh'

TYRAS_BUILD_MODE="$1"
if [ "${TYRAS_BUILD_MODE}" = "run" ] || [ "${TYRAS_BUILD_MODE}" = "ci" ]; then
  if [ "$#" -gt 0 ]; then
    shift
  fi
else
  TYRAS_BUILD_MODE='run'
fi

yarn run "build:${TYRAS_BUILD_MODE}"