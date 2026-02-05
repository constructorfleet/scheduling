# Deployment & Operations Guide

## Alignment with architecture
The Scheduling Application is a standalone HTML5 experience with offline-first behavior, a clear separation of domain/rules logic, and IndexedDB-backed persistence (see `PROJECT.md`). That means every release can be distributed purely as static assets—no server-side runtime is required—so our deployment strategy centers on reproducible static bundles and simple hosting targets (CDNs, corporate intranets, or internal file shares).

## Scripts reference
- The scripts in `artifacts/phase-9-deployment/build-scripts/README.md` summarize the commands maintained under `scripts/` that produce and ship the static bundle (`build-static.sh` and `deploy-static.sh`). Keep that document in sync with any changes to the underlying automation.

## Reproducible build workflow
1. **Prerequisites**  
   - Node.js 18+ (per `package.json` engines) and npm installed.  
   - Git checkout clean or intentionally dirty commits recorded in metadata.
2. **Run the orchestrated build**  
   ```bash
   ./scripts/build-static.sh
   ```  
   Optional flags: `SKIP_TYPE_CHECK=1` skips the type-check phase if you only need the latest UI bundle.
3. **Key outputs**  
   - `dist-static/` — complete static site ready to publish (assets, `index.html`, manifest).  
   - `dist-static/build-metadata.json` — commit, branch, timestamp, and command trace for audit/compliance.  
   - `dist-static-<timestamp>.tar.gz` — tarball suitable for release archives, QA handoff, or storage in versioned buckets.
4. **Validation**  
   - Verify the archive’s `build-metadata.json` before deployment to trace rule compliance to a commit.  
   - `npm run lint` and `npm test` are not part of the build script, so run them explicitly before committing a release candidate.

## Configuration reference

| Variable | Applies to | Purpose |
| --- | --- | --- |
| `SKIP_TYPE_CHECK=1` | Build | Skip the `npm run type-check` stage when you only need a fresh UI bundle; defaults to `0`. |
| `AWS_S3_BUCKET` | Deploy | Required for S3/CDN deployments; `aws s3 sync` mirrors `dist-static/` into this bucket. |
| `AWS_S3_PREFIX` | Deploy | Optional key prefix inside the bucket (e.g., `prod/2026.02.05`). |
| `AWS_PROFILE` | Deploy | For multi-profile setups; forwarded directly to the AWS CLI. |
| `DEPLOY_HOST` | Deploy | Remote server hostname that receives the `rsync` sync. |
| `DEPLOY_USER` | Deploy | SSH user for `rsync`; defaults to the current `$USER`. |
| `DEPLOY_PATH` | Deploy | Destination directory on `DEPLOY_HOST`; required when `DEPLOY_HOST` is set. |
| `DEPLOY_LOCAL_PATH` | Deploy | Local filesystem target for straight disk copies (useful for pilots or wrapped installers). |

`scripts/deploy-static.sh` refuses to run without one of the deployment targets (`AWS_S3_BUCKET`, `DEPLOY_HOST` + `DEPLOY_PATH`, or `DEPLOY_LOCAL_PATH`), so always stage the bundle via `npm run build:static` before invoking the deploy step.

## Packaging considerations
- Clean slate: `scripts/build-static.sh` runs `npm run clean` before building, ensuring deterministic outputs.  
- Source map inclusion (`vite.config.ts` enables sourcemaps) aids debugging but can be stripped in future releases when not needed; update the build script accordingly.  
- The `build-metadata.json` is intentionally human-readable for operational audits and consumed by dashboards or release notes.

## Deployment targets
1. **S3 / CDN (preferred for district-wide rollout)**  
   ```bash
   AWS_S3_BUCKET=daycare-static-releases AWS_S3_PREFIX=prod/2026.02.05 ./scripts/deploy-static.sh
   ```  
   - Requires AWS CLI installed and credentials configured (`AWS_PROFILE`, `AWS_REGION`, etc.).  
   - The script runs `aws s3 sync` with `--exact-timestamps` and `--delete` so the bucket mirrors the local bundle.  
   - After upload, trigger cache invalidation on CloudFront or your CDN for `index.html`, `assets/`, and `build-metadata.json`.
2. **Remote host via rsync (for on-prem kiosk deployments)**  
   ```bash
   DEPLOY_HOST=school-site DEPLOY_PATH=/var/www/daycare DEPLOY_USER=svc-deploy ./scripts/deploy-static.sh
   ```  
   - The bundle is synchronized with `rsync --delete` so stale assets are removed.  
   - Service owners should restart any local reverse proxy (if present) to pick up the new `index.html`.
3. **Local filesystem (adhoc QA / pilot proof-of-concept)**  
   ```bash
   DEPLOY_LOCAL_PATH=/opt/daycare-scheduler ./scripts/deploy-static.sh
   ```  
   - Useful during pilot rollouts where the app is served from an internal file share or launched from an Electron wrapper.

## Update & release cadence
- **Release tagging**: embed the `dist-static-<timestamp>.tar.gz` identifier in release notes.  
- **Version tracking**: copy `build-metadata.json` into your release tracker (e.g., SharePoint, Notion) so directors can trace what commit produced a release.  
- **Automated pipeline**: run `scripts/build-static.sh` inside CI (e.g., GitHub Actions) and upload both the tarball and `dist-static/` to a release artifact store before invoking `scripts/deploy-static.sh`.
- **CI/CD snippet**: a reproducible pipeline only needs
  1. `npm ci` (or `npm install`) plus any tooling setup you require.  
  2. `npm run build:static` (set `SKIP_TYPE_CHECK=1` if your linting/tests already run elsewhere).  
  3. Publish `dist-static-*.tar.gz` and `dist-static/` as artifacts for auditors or downstream deployments.  
  4. Optionally run `AWS_S3_BUCKET=... npm run deploy:static` or `DEPLOY_HOST=... DEPLOY_PATH=... ./scripts/deploy-static.sh` from a trusted runner that has network access to the target.  
  Retain the generated `build-metadata.json` alongside each artifact so consumers can tie a deployment URL back to the originating commit and environment.

## Rollback & rollback detection
- Keep the previous tarball (and optionally a copy of `dist-static/`) in your artifact storage.  
- To roll back, re-stage the older `dist-static/`, rerun `scripts/deploy-static.sh`, and note the rollback timestamp in your deployment log.  
- The metadata file will expose whether the rollback affected commit history (`dirty` flag) so auditors know if the previous build matched a clean git state.

## Verification & monitoring
- After each deployment, open `index.html` through the chosen host to confirm the UI loads and connects to the local IndexedDB snapshots.  
- Check `build-metadata.json` via HTTP to ensure the served bundle matches the release under test (use curl or the browser devtools network inspector).  
- Promote automated sanity checks (e.g., Playwright smoke tests against the deployed URL) as part of the release pipeline.

## Operational notes
- Cache expiration: set far-future caching on `assets/` (hash-based), but keep `index.html`/`build-metadata.json` short-lived so directors see the latest release.  
- Audit trail: add a short note to your deployment log referencing the metadata `generatedAt` timestamp and commit so the compliance team can trace every change.  
- Communication: once deployed, notify site directors with the release bundle name (e.g., `dist-static-20260205T190000Z`) so they can match it with scheduling instructions or user docs.
