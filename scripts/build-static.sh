#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLEAN_CMD="npm run clean"
TYPE_CHECK_CMD="npm run type-check"
UI_BUILD_CMD="npm run build:ui"
DIST_UI_DIR="$ROOT_DIR/dist/ui"
STAGING_DIR="$ROOT_DIR/dist-static"
ARCHIVE_TS="$(date -u +"%Y%m%dT%H%M%SZ")"
BUILD_TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SKIP_TYPE_CHECK_RAW="${SKIP_TYPE_CHECK:-0}"
case "$SKIP_TYPE_CHECK_RAW" in
  1|[Tt][Rr][Uu][Ee]) TYPE_CHECK_SKIPPED="true" ;;
  *) TYPE_CHECK_SKIPPED="false" ;;
esac

COMMANDS=()

info() {
  printf '\033[1;34m[build-static]\033[0m %s\n' "$*"
}

die() {
  printf '\033[1;31m[build-static]\033[0m %s\n' "$*" >&2
  exit 1
}

info "Ensuring prerequisites are available"
command -v npm >/dev/null 2>&1 || die "npm must be installed"
command -v node >/dev/null 2>&1 || die "node must be installed"
if command -v python3 >/dev/null 2>&1; then
  PYTHON_CMD="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON_CMD="$(command -v python)"
else
  die "python3 or python must be installed"
fi

info "Cleaning previous artifacts"
COMMANDS+=("$CLEAN_CMD")
eval "$CLEAN_CMD"

if [[ "$TYPE_CHECK_SKIPPED" == "false" ]]; then
  info "Running type check"
  COMMANDS+=("$TYPE_CHECK_CMD")
  NODE_ENV=production $TYPE_CHECK_CMD
else
  info "Skipping type check (SKIP_TYPE_CHECK=${SKIP_TYPE_CHECK_RAW})"
fi

info "Bundling UI (Vite)"
COMMANDS+=("$UI_BUILD_CMD")
NODE_ENV=production $UI_BUILD_CMD

if [[ ! -d "$DIST_UI_DIR" ]]; then
  die "Vite build output missing (expected $DIST_UI_DIR)"
fi

info "Staging static assets"
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"
cp -R "$DIST_UI_DIR"/. "$STAGING_DIR"/

GIT_COMMIT="unknown"
GIT_BRANCH="unknown"
GIT_DIRTY="false"
if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  GIT_COMMIT="$(git -C "$ROOT_DIR" rev-parse HEAD)"
  GIT_BRANCH="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"
  if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
    GIT_DIRTY="true"
  fi
fi

NODE_VERSION="$(node --version)"
NPM_VERSION="$(npm --version)"

META_FILE="$STAGING_DIR/build-metadata.json"

info "Recording build metadata"
COMMANDS_JSON_ARRAY=$($PYTHON_CMD - <<'PY' "${COMMANDS[@]}"
import json, sys
print(json.dumps(sys.argv[1:]))
PY
)
(
  export COMMANDS_JSON_ARRAY BUILD_TS ARCHIVE_TS NODE_VERSION NPM_VERSION GIT_COMMIT GIT_BRANCH GIT_DIRTY TYPE_CHECK_SKIPPED
  "$PYTHON_CMD" - <<'PY'
import json, os

meta = {
  "generatedAt": os.environ["BUILD_TS"],
  "archiveTimestamp": os.environ["ARCHIVE_TS"],
  "commands": json.loads(os.environ["COMMANDS_JSON_ARRAY"]),
  "versions": {
    "node": os.environ["NODE_VERSION"],
    "npm": os.environ["NPM_VERSION"]
  },
  "vcs": {
    "commit": os.environ["GIT_COMMIT"],
    "branch": os.environ["GIT_BRANCH"],
    "dirty": os.environ["GIT_DIRTY"].lower() == "true"
  },
  "environment": {
    "nodeEnv": "production",
    "skipTypeCheck": os.environ["TYPE_CHECK_SKIPPED"] == "true"
  }
}

print(json.dumps(meta, indent=2))
PY
) > "$META_FILE"

ARCHIVE_NAME="dist-static-${ARCHIVE_TS}.tar.gz"
ARCHIVE_PATH="$ROOT_DIR/$ARCHIVE_NAME"

info "Producing release archive $ARCHIVE_NAME"
tar -C "$STAGING_DIR" -czf "$ARCHIVE_PATH" .

info "Build complete"
info "Static assets staged at: $STAGING_DIR"
info "Release bundle: $ARCHIVE_PATH"
