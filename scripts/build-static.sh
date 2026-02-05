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

info "Cleaning previous artifacts"
eval "$CLEAN_CMD"

if [[ "${SKIP_TYPE_CHECK:-0}" != "1" ]]; then
  info "Running type check"
  NODE_ENV=production $TYPE_CHECK_CMD
else
  info "Skipping type check (SKIP_TYPE_CHECK=1)"
fi

info "Bundling UI (Vite)"
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
cat <<EOF > "$META_FILE"
{
  "generatedAt": "$BUILD_TS",
  "archiveTimestamp": "$ARCHIVE_TS",
  "commands": [
    "$CLEAN_CMD",
    "$TYPE_CHECK_CMD",
    "$UI_BUILD_CMD"
  ],
  "versions": {
    "node": "$NODE_VERSION",
    "npm": "$NPM_VERSION"
  },
  "vcs": {
    "commit": "$GIT_COMMIT",
    "branch": "$GIT_BRANCH",
    "dirty": $GIT_DIRTY
  },
  "environment": {
    "nodeEnv": "production",
    "skipTypeCheck": "${SKIP_TYPE_CHECK:-0}"
  }
}
EOF

ARCHIVE_NAME="dist-static-${ARCHIVE_TS}.tar.gz"
ARCHIVE_PATH="$ROOT_DIR/$ARCHIVE_NAME"

info "Producing release archive $ARCHIVE_NAME"
tar -C "$STAGING_DIR" -czf "$ARCHIVE_PATH" .

info "Build complete"
info "Static assets staged at: $STAGING_DIR"
info "Release bundle: $ARCHIVE_PATH"
