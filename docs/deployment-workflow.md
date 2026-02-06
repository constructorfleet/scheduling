# Static Build & Deployment Workflow

## Architecture alignment
- The static bundle is the runtime: a Vite/React HTML5 shell that implements the guided scheduler, rules engine, persistence, and audit streams described in the architecture blueprint so every release is a self-contained single-arch client-side site rather than a server process.
- Because every UI interaction feeds typed domain models and the rules engine described in `artifacts/phase-2-architecture/architecture.md:8`, the static assets must surface the same data/persistence contracts that deliver compliance, which is why deployments simply upload the built `dist-static/` tree.

## Prerequisites & environment
- Node.js ≥18 and npm (per `package.json` engines) plus either `python3` or `python` for metadata serialization; the build script enforces those checks before starting the pipeline (`scripts/build-static.sh:29-38`).
- A working git workspace so `scripts/build-static.sh` can capture `commit`, `branch`, and `dirty` flags for the audit metadata (`scripts/build-static.sh:65-74`).

## Build pipeline
1. Run `./scripts/build-static.sh` (the alias `npm run build:static` does the same) with `SKIP_TYPE_CHECK=0` by default. The script cleans the workspace (`npm run clean`), optionally runs `npm run type-check`, and then runs `npm run build:ui` under `NODE_ENV=production` to produce the optimized `dist/ui` bundle (`scripts/build-static.sh:40-55`).
2. Once the Vite output exists, it stages the contents from `dist/ui` into `dist-static/` so the deployment tree exactly mirrors what will be served (`scripts/build-static.sh:56-64`).
3. Build metadata is recorded in `dist-static/build-metadata.json`, capturing the ordered `commands`, Node/npm versions, git identifiers, and whether type checking was skipped—this file is mandatory for audits and rollback tracking (`scripts/build-static.sh:76-113`).
4. A tarball named `dist-static-<timestamp>.tar.gz` is created from the staged assets to make every release a single, reproducible archive that operators can eject onto any host (`scripts/build-static.sh:115-123`).

## Bundling & audit artifacts
- Keep `dist-static/`, `dist-static/build-metadata.json`, and the timestamped tarball together when signing off on a release—`build-metadata.json` explains exactly which commands ran so reviewers can see whether the type check was skipped or not (`scripts/build-static.sh:81-113`).
- The `commands` array records each CLI step (clean, type-check, build) so you can correlate failing deployments with the precise workflow that produced them; the `environment.skipTypeCheck` flag immediately flags risky, fast iterations.

## Deployment configuration
- Use `scripts/deploy-static.sh` to ship the staged assets once the build succeeds. The script refuses to run without `dist-static/`, so always rebuild before deploying (`scripts/deploy-static.sh:41-43`).
- Supported targets: S3/CDN sync (`AWS_S3_BUCKET` + optional `AWS_S3_PREFIX`), rsync to a remote host (`DEPLOY_HOST` + `DEPLOY_PATH`), or a local copy (`DEPLOY_LOCAL_PATH`) so deployments can cover district CDNs, on-prem kiosks, or pilot file shares (`scripts/deploy-static.sh:45-75`).
- For S3, include `--exact-timestamps --delete` so buckets mirror the local bundle and manually trigger CDN invalidation afterward; for remote hosts, `rsync -az --delete` removes stale files while you optionally restart fronting proxies to refresh cached `index.html`.
- Always supply either an S3 target, a remote host + path, or a local path; the script errors out otherwise so you cannot accidentally push from an empty build tree (`scripts/deploy-static.sh:76`).

## Operations notes & risk mitigations
- Before new releases, run the Jest suites listed in `docs/technical-operations-guide.md:47` (day metadata, timeline, violation navigator) so the metadata and guided workflows stay stable; those docs also remind you to install `jest-environment-jsdom` on any fresh runner before executing React/DOM specs.
- Playwright e2e coverage is blocked until Vite can bind to `127.0.0.1:4174` (`docs/technical-operations-guide.md:49`), so resolve that binding or adjust `playwright.config.ts` before trusting smoke tests in CI.
- Verify the fresh `build-metadata.json` inside `dist-static/` post-build so the `generatedAt` timestamp, commit hash, and `skipTypeCheck` flag match the candidate you intend to deploy; include that metadata alongside the release artifacts for downstream traceability (`scripts/build-static.sh:81-113`).
- Use the metadata and tarball to drive rollbacks: keep the previous bundle on hand, redeploy it via the same scripts, and log the rollback timestamp along with the metadata’s `generatedAt` so auditors understand which static assets directors will run.
- Treat `index.html` and `build-metadata.json` as cache-sensitive—set short-lived caching headers while `assets/` remain long-lived hashed files to prevent directors from seeing stale releases.
