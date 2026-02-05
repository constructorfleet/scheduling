#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING_DIR="$ROOT_DIR/dist-static"

info() {
  printf '\033[1;34m[deploy-static]\033[0m %s\n' "$*"
}

die() {
  printf '\033[1;31m[deploy-static]\033[0m %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<EOF
deploy-static: copy the staged static bundle to a deployment target.

Usage:
  AWS_S3_BUCKET=... [AWS_S3_PREFIX=...] ./scripts/deploy-static.sh
  DEPLOY_LOCAL_PATH=/path ./scripts/deploy-static.sh
  DEPLOY_HOST=host DEPLOY_PATH=/var/www ./scripts/deploy-static.sh

Environment variables:
  AWS_S3_BUCKET     bucket to sync the contents into (requires AWS CLI)
  AWS_S3_PREFIX     optional key prefix (defaults to no prefix)
  AWS_PROFILE       passed to aws CLI if set
  DEPLOY_HOST       remote host for rsync deployment
  DEPLOY_USER       ssh user for remote deployment (defaults to current user)
  DEPLOY_PATH       destination path on remote host
  DEPLOY_LOCAL_PATH local filesystem directory to sync to
EOF
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -d "$STAGING_DIR" ]]; then
  die "Staged bundle missing at $STAGING_DIR; run scripts/build-static.sh first"
fi

if [[ -n "${AWS_S3_BUCKET:-}" ]]; then
  command -v aws >/dev/null 2>&1 || die "AWS CLI required for S3 deployment"
  DEST="s3://${AWS_S3_BUCKET%/}"
  if [[ -n "${AWS_S3_PREFIX:-}" ]]; then
    DEST="$DEST/${AWS_S3_PREFIX#/}"
  fi
  info "Syncing $STAGING_DIR -> $DEST"
  AWS_PROFILE_ARG=()
  if [[ -n "${AWS_PROFILE:-}" ]]; then
    AWS_PROFILE_ARG=(--profile "$AWS_PROFILE")
  fi
  aws "${AWS_PROFILE_ARG[@]}" s3 sync "$STAGING_DIR/" "$DEST/" --delete --no-progress --exact-timestamps
  info "Cache invalidation recommended for CDN in front of $DEST"
  exit 0
fi

if [[ -n "${DEPLOY_HOST:-}" ]]; then
  [[ -n "${DEPLOY_PATH:-}" ]] || die "DEPLOY_PATH must be set when using DEPLOY_HOST"
  DEPLOY_USER="${DEPLOY_USER:-$USER}"
  info "Syncing $STAGING_DIR -> ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
  rsync -az --delete "$STAGING_DIR"/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"
  exit 0
fi

if [[ -n "${DEPLOY_LOCAL_PATH:-}" ]]; then
  mkdir -p "$DEPLOY_LOCAL_PATH"
  info "Copying $STAGING_DIR -> $DEPLOY_LOCAL_PATH"
  rsync -a --delete "$STAGING_DIR"/ "$DEPLOY_LOCAL_PATH"/
  exit 0
fi

die "No deployment target specified. Set AWS_S3_BUCKET, DEPLOY_HOST+DEPLOY_PATH, or DEPLOY_LOCAL_PATH."
