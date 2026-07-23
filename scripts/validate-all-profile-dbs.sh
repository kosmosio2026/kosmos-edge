#!/usr/bin/env bash

set -u

ROOT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"

cd "$ROOT_DIR"

overall_rc=0

for profile in \
  cloud \
  edge \
  edge-standalone \
  demo \
  development
do
  echo
  echo "=================================================="
  echo "DATABASE VALIDATION: $profile"
  echo "=================================================="

  pnpm profile:db:validate "$profile"
  database_rc=$?

  pnpm profile:db:drift:validate "$profile"
  drift_rc=$?

  echo \
    "DATABASE_VALIDATE_RC=$profile:$database_rc"

  echo \
    "SCHEMA_DRIFT_VALIDATE_RC=$profile:$drift_rc"

  if [ "$database_rc" -ne 0 ] ||
     [ "$drift_rc" -ne 0 ]; then
    overall_rc=1
  fi
done

echo
echo \
  "ALL_PROFILE_DATABASE_VALIDATION_RC=$overall_rc"

exit "$overall_rc"
