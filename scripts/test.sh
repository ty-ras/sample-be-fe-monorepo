#!/bin/sh

. 'scripts/preamble.sh'

TYRAS_TEST_MODE="$1"
if [ "${TYRAS_TEST_MODE}" = "run" ] || [ "${TYRAS_TEST_MODE}" = "coverage" ]; then
  if [ "$#" -gt 0 ]; then
    shift
  fi
else
  TYRAS_TEST_MODE='run'
fi

yarn run "test:${TYRAS_TEST_MODE}" "$@"
