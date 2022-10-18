#!/bin/sh

# Note that this script will be executed BEFORE Postgres DB will become 'visible' to other services on port 5432.
set -e

echo 'SET client_min_messages TO WARNING;' > ~/.psqlrc
psqlq ()
{
  psql --quiet -v "ON_ERROR_STOP=1" "$@"
}
psqlqd ()
{
  psqlq --dbname "${TYRAS_DB_DATABASE}" "$@"
}

# Create DB, role, and login
psqlq \
  -c "CREATE DATABASE ${TYRAS_DB_DATABASE} ENCODING UTF8;" \
  -c "CREATE ROLE ${TYRAS_DB_BE_ROLENAME} NOLOGIN;
CREATE ROLE ${TYRAS_DB_BE_USERNAME} NOINHERIT LOGIN PASSWORD '${TYRAS_DB_BE_PASSWORD}' IN ROLE ${TYRAS_DB_BE_ROLENAME};"

# Run migrations (poor man's version of Flyway)
for SQL_FILE in $(find '/migrations' -type f -mindepth 1 -maxdepth 1 -name 'V*.sql' | sort); do
  psqlqd -f "${SQL_FILE}"
done

for SQL_FILE in $(find '/migrations' -type f -mindepth 1 -maxdepth 1 -name 'R*.sql' | sort); do
  psqlqd -f "${SQL_FILE}"
done
