# Deployment Plan

## Objectives
- Anchor every release to the reproducible, static bundle produced by `./scripts/build-static.sh`, including its audit-friendly `build-metadata.json` and the stamped tarball (`dist-static-<timestamp>.tar.gz`).
- Define a repeatable handoff that lets the Deployment & Ops Agent move candidates into production (CDN, on-prem kiosk, or pilot) while preserving verification, cache controls, and rollback signals.
- Capture the operational steps (packaging → validation → release → monitoring) so downstream agents can automate or follow the same checklist without ambiguity.

## Packaging workflow
1. **Prerequisites** – ensure the release machine meets the `package.json` engines: Node.js ≥18 and npm, git status recorded for `build-metadata.json`, and the shell environment can execute `bash ./scripts/build-static.sh`.
2. **Run the build script** – invoke `npm run build:static` (optionally `SKIP_TYPE_CHECK=1` during rapid iteration). The script enforces a clean slate, type-check (unless skipped), Vite build, staging to `dist-static/`, and metadata capture.
3. **Artifact capture** – keep the staged folder, `build-metadata.json`, and the generated `dist-static-<timestamp>.tar.gz` together with every release bundle so QA or ops can replay an exact byte-equivalent deployment.

## Verification gates
- Open `dist-static/build-metadata.json` immediately after the build to confirm the `commands` array (and `skipTypeCheck` flag) plus the `versions` (node + npm) and `vcs` (`commit`, `branch`, `dirty`) sections tie the bundle to a known Git state and the expected phases executed.
- If metadata flags `dirty: true`, raise the exception in your release log and confirm the change is intentional before proceeding.
- Optionally run `npm run lint` / `npm test` outside the build script and capture their outputs in your release notes (useful for compliance), but do not rely on the build for these checks.

## Deployment targets & commands
| Target | Command | Notes |
| --- | --- | --- |
| **S3 / CDN (district rollout)** | `AWS_S3_BUCKET=<bucket> [AWS_S3_PREFIX=<prefix>] npm run deploy:static` | Uses `aws s3 sync --exact-timestamps --delete`. After upload, invalidate caches for `index.html`, `build-metadata.json`, and fingerprinted assets. |
| **On-prem / kiosk host** | `DEPLOY_HOST=<host> DEPLOY_PATH=<path> [DEPLOY_USER=...] npm run deploy:static` | Relies on `rsync` to mirror `dist-static/`; restarting a proxy (if present) ensures the latest `index.html` is served. |
| **Local filesystem / pilot** | `DEPLOY_LOCAL_PATH=<path> npm run deploy:static` | Good for proof-of-concepts or packaging with another installer (e.g., Electron wrapper). |
- If no target vars are set, `deploy-static.sh` aborts—always run `build-static` first and select exactly one target per release.

## Automation & release flow
1. **CI pipeline** – in CI (GitHub Actions, etc.) run `npm ci`, `npm run build:static` (pass `SKIP_TYPE_CHECK=1` if the job already runs type checks), and publish both the `dist-static/` directory and the tarball as artifacts.
2. **Metadata propagation** – upload `build-metadata.json` alongside the artifacts and include its `generatedAt` timestamp and commit hash in your automation logs or release description.
3. **Trigger deployment** – from a trusted runner (with AWS CLI or SSH access), source the same repository, ensure `dist-static/` matches the release you staged (optionally verify with `build-metadata.json`), and run the appropriate `npm run deploy:static` invocation.
4. **Cache & CDN** – after deployment, invalidate caches for dynamic files; hashed assets can remain cached long-term, but `index.html` and `build-metadata.json` must be short-lived so directors immediately see the new release.
5. **Communication** – note the bundle name (e.g., `dist-static-20260205T034319Z.tar.gz`) when notifying site directors, compliance, or QA.

## Rollback & observability
- Archive the previous tarball + metadata so you can redeploy it quickly. To roll back, re-stage that bundle, rerun `npm run deploy:static`, and log the rollback timestamp relative to the metadata’s `generatedAt`.
- After deployment, confirm the front-end responds with HTTP 200 and that the browser/devtools serve the correct `build-metadata.json`.
- Encourage a light smoke test against the deployed host (Playwright or manual) to ensure the scheduler loads into its guided workspace. This can become an automated post-deploy check.

## Next actions for Deployment & Ops Agent
1. Keep `artifacts/phase-9-deployment/deployment-checklist.md` synchronized with any changes to `scripts/build-static.sh` or `scripts/deploy-static.sh`.
2. If new hosting targets emerge (e.g., an internal CDN or offline kiosk), extend this plan with concrete commands and caching notes before the next release.
3. Ensure every release log references the metadata’s `generatedAt` and commit so compliance teams can trace which static bundle directors are running.
