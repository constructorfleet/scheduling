# Build Scripts

This folder surfaces the scripts that produce and publish the static bundle referenced in the deployment guide.

## Build static bundle

- **Script**: `./scripts/build-static.sh` (pulled in by `npm run build:static`).
- **Purpose**: cleans previous artifacts, optionally runs `npm run type-check`, compiles the UI with Vite into `dist/ui`, stages everything under `dist-static/`, writes `build-metadata.json`, and packages the artifacts as `dist-static-<timestamp>.tar.gz`.
- **Environment knobs**:
  - `SKIP_TYPE_CHECK=1` skips the type-check step when you only need a fresh UI build.
- **Outputs**: `dist-static/`, `dist-static/build-metadata.json`, and the timestamped tarball next to the repo root.

## Deploy static bundle

- **Script**: `./scripts/deploy-static.sh` (invoked via `npm run deploy:static`).
- **Purpose**: copies the staged `dist-static/` bundle to the configured destination (S3 bucket, remote host, or local path).
- **Environment variables**:
  - `AWS_S3_BUCKET` / `AWS_S3_PREFIX` for bucket deployments (requires AWS CLI).
  - `DEPLOY_HOST`, `DEPLOY_USER`, and `DEPLOY_PATH` for rsync targets.
  - `DEPLOY_LOCAL_PATH` for syncing to a local directory.
  - `AWS_PROFILE` is forwarded to the AWS CLI when provided.
- **Precondition**: run the build script first so `dist-static/` exists.

## Invocation summary

```bash
npm run build:static
SKIP_TYPE_CHECK=1 npm run build:static
AWS_S3_BUCKET=... npm run deploy:static
```
