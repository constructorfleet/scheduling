# Deployment Checklist

Use this checklist every time you cut a release so the static bundle, metadata, and deployment targets stay reproducible and auditable.

## 1. Build & stage the static bundle
- [ ] Run `npm run build:static` from the repository root (set `SKIP_TYPE_CHECK=1` if you only need the UI bundle during iteration).
- [ ] Confirm `dist-static/` exists and contains the hashed `assets/` directory plus `index.html`, `build-metadata.json`, and other static files.
- [ ] Open `dist-static/build-metadata.json` and verify it records the `commands` array, `versions` (node + npm), and `vcs` details (`commit`, `branch`, `dirty`) that tie the build back to a single git state.
- [ ] Retain the `dist-static-<timestamp>.tar.gz` archive that `build-static.sh` produces next to the repo root for release notes, QA handoffs, or artifact storage.

## 2. Validate & log the release
- [ ] Copy the `generatedAt` timestamp (UTC) and artifact name into your release tracker (e.g., SharePoint, Notion, or your deployment log) so directors can trace the rollout.
- [ ] Note whether `build-metadata.json` flagged `dirty: true`—if it did, an intentional dirty build was made and requires sign-off.
- [ ] Collect the tarball and `build-metadata.json` alongside any other CI artifacts so auditors can replay the bundle if needed.

## 3. Deploy to the chosen target
- [ ] For S3/CDN rollouts: run `AWS_S3_BUCKET=<bucket> [AWS_S3_PREFIX=<prefix>] npm run deploy:static` (requires `aws` CLI). The script calls `aws s3 sync --exact-timestamps --delete` so the bucket mirrors `dist-static/` exactly.
- [ ] For on-prem kiosks: run `DEPLOY_HOST=<host> DEPLOY_PATH=<path> [DEPLOY_USER=<user>] npm run deploy:static` to rsync the bundle.
- [ ] For local pilots: run `DEPLOY_LOCAL_PATH=<path> npm run deploy:static` and serve that path through whatever static server you need.
- [ ] After uploading to S3 or syncing to a host, invalidate caches for `index.html`, `build-metadata.json`, and the `assets/` fingerprinted files so the new release becomes live.

## 4. Verify the deployment
- [ ] `curl` the deployed `index.html` (or open it in a browser) and ensure it returns HTTP 200 and renders the UI.
- [ ] `curl <target>/build-metadata.json` and confirm that the metadata matches the release you just staged (commit hash, branch, timestamp, commands, and `dirty` flag).
- [ ] Run a quick smoke test (Playwright, manual checklist, or the UI flows in `tests/ui`) against the deployed URL to make sure the scheduler loads and can open a week view.
- [ ] Verify CDN cache settings leave hashed assets cached long-term while keeping `index.html` and `build-metadata.json` short-lived.

## 5. Rollback & audit signals
- [ ] Keep the previous tarball and `build-metadata.json` in your artifact store so you can redeploy it if needed.
- [ ] If a rollback is required, re-stage the older `dist-static/` bundle, rerun `npm run deploy:static` with that bundle, and document the rollback timestamp next to the metadata entry.
- [ ] Add a short note to your deployment log referencing the metadata `generatedAt` timestamp and commit so compliance can trace every change.

## Helpful references
- `artifacts/phase-9-deployment/build-scripts/README.md` lists the scripts invoked by `npm run build:static` and `npm run deploy:static`.
- `artifacts/phase-9-deployment/deployment-guide.md` explains preferred targets, cache invalidation, CI snippets, and monitoring guidance.
