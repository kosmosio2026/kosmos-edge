#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

MODE="${1:---check}"

case "$MODE" in
  --check|--apply)
    ;;
  *)
    echo "사용법: $0 --check|--apply" >&2
    exit 1
    ;;
esac

RUN_USER="${KOSMOS_RUN_USER:-$(id -un)}"
RUN_GROUP="${KOSMOS_RUN_GROUP:-$(id -gn)}"
RUN_HOME="${KOSMOS_RUN_HOME:-$(getent passwd "$RUN_USER" | cut -d: -f6)}"
INSTALL_ROOT="${KOSMOS_INSTALL_ROOT:-$KOSMOS_ROOT}"

PNPM_PATH="$(command -v pnpm || true)"

if [ -z "$PNPM_PATH" ]; then
  echo "pnpm 명령을 찾을 수 없습니다." >&2
  exit 1
fi

PNPM_DIR="$(dirname "$PNPM_PATH")"

if [ "$PNPM_DIR" = "/usr/local/bin" ]; then
  RUNTIME_PATH="/usr/local/bin:/usr/bin:/bin"
else
  RUNTIME_PATH="${PNPM_DIR}:/usr/local/bin:/usr/bin:/bin"
fi

SOURCE_DIR="${KOSMOS_ROOT}/deploy/systemd"
STAMP="$(date +%Y%m%d-%H%M%S)"
RENDER_DIR="${KOSMOS_ROOT}/build/systemd-rendered/${STAMP}"
BACKUP_DIR="${KOSMOS_ROOT}/backups/systemd/${STAMP}"

mkdir -p \
  "$RENDER_DIR" \
  "$BACKUP_DIR"

FILES=(
  "kosmos-db@.service"
  "kosmos-api@.service"
  "kosmos-web@.service"
  "kosmos-profile@.target"
)

render_file() {
  local source_file="$1"
  local rendered_file="$2"

  SOURCE_FILE="$source_file" \
  RENDERED_FILE="$rendered_file" \
  RUN_USER="$RUN_USER" \
  RUN_GROUP="$RUN_GROUP" \
  RUN_HOME="$RUN_HOME" \
  INSTALL_ROOT="$INSTALL_ROOT" \
  PNPM_DIR="$PNPM_DIR" \
  RUNTIME_PATH="$RUNTIME_PATH" \
  python3 <<'PY'
from pathlib import Path
import os
import re

source = Path(os.environ["SOURCE_FILE"])
target = Path(os.environ["RENDERED_FILE"])

text = source.read_text()

replacements = {
    "__KOSMOS_RUN_USER__":
        os.environ["RUN_USER"],
    "__KOSMOS_RUN_GROUP__":
        os.environ["RUN_GROUP"],
    "__KOSMOS_HOME__":
        os.environ["RUN_HOME"],
    "__KOSMOS_ROOT__":
        os.environ["INSTALL_ROOT"],
    "__KOSMOS_PNPM_DIR__":
        os.environ["PNPM_DIR"],
    "__KOSMOS_RUNTIME_PATH__":
        os.environ["RUNTIME_PATH"],
}

for before, after in replacements.items():
    text = text.replace(before, after)

remaining = sorted(
    set(
        re.findall(
            r"__[A-Z0-9_]+__",
            text,
        )
    )
)

if remaining:
    raise SystemExit(
        "Unresolved systemd placeholders: "
        + ", ".join(remaining)
    )

target.write_text(text)
PY
}

echo "===== SYSTEMD RENDER SETTINGS ====="
echo "Mode        : $MODE"
echo "Run user    : $RUN_USER"
echo "Run group   : $RUN_GROUP"
echo "Run home    : $RUN_HOME"
echo "Install root: $INSTALL_ROOT"
echo "pnpm path   : $PNPM_PATH"
echo "Runtime PATH: $RUNTIME_PATH"
echo "Render dir  : $RENDER_DIR"
echo

for filename in "${FILES[@]}"
do
  source_file="${SOURCE_DIR}/${filename}"
  rendered_file="${RENDER_DIR}/${filename}"
  current_file="/etc/systemd/system/${filename}"

  if [ ! -f "$source_file" ]; then
    echo "템플릿이 없습니다: $source_file" >&2
    exit 1
  fi

  render_file \
    "$source_file" \
    "$rendered_file"

  echo "===== ${filename} ====="

  if [ -f "$current_file" ]; then
    diff -u \
      "$current_file" \
      "$rendered_file" || true
  else
    echo "NEW FILE: $current_file"
    cat "$rendered_file"
  fi

  echo
done

echo "===== VERIFY RENDERED SYSTEMD UNITS ====="

VERIFY_LOG="${RENDER_DIR}/systemd-analyze-verify.log"

set +e

systemd-analyze verify \
  "${RENDER_DIR}/kosmos-db@.service" \
  "${RENDER_DIR}/kosmos-api@.service" \
  "${RENDER_DIR}/kosmos-web@.service" \
  "${RENDER_DIR}/kosmos-profile@.target" \
  > "$VERIFY_LOG" 2>&1

VERIFY_STATUS=$?

set -e

if [ "$VERIFY_STATUS" -ne 0 ]; then
  echo "SYSTEMD_TEMPLATE_VERIFY=FAIL" >&2
  cat "$VERIFY_LOG" >&2
  exit "$VERIFY_STATUS"
fi

if [ -s "$VERIFY_LOG" ]; then
  cat "$VERIFY_LOG"
fi

echo "SYSTEMD_TEMPLATE_VERIFY=OK"
echo

if [ "$MODE" = "--check" ]; then
  echo "CHECK COMPLETE"
  echo "실제 Systemd 파일은 변경하지 않았습니다."
  exit 0
fi

echo "===== APPLY SYSTEMD FILES ====="

for filename in "${FILES[@]}"
do
  rendered_file="${RENDER_DIR}/${filename}"
  current_file="/etc/systemd/system/${filename}"

  if [ -f "$current_file" ]; then
    sudo cp -a \
      "$current_file" \
      "${BACKUP_DIR}/${filename}"
  fi

  sudo install \
    -m 0644 \
    "$rendered_file" \
    "$current_file"

  echo "INSTALLED: $current_file"
done

sudo systemctl daemon-reload

echo
echo "APPLY COMPLETE"
echo "Backup directory: $BACKUP_DIR"
echo
echo "기존 drop-in 파일은 삭제하거나 변경하지 않았습니다."
echo "서비스는 자동으로 재시작하지 않았습니다."
