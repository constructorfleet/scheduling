# Deployment & Operations Strategy

## Purpose
Describe how to package, deploy, and update the scheduling workspace so each build ends up as a standalone HTML5 bundle that can be audited, rolled back, and redeployed without depending on a backend runtime.

## Build & Packaging
1. **Prerequisites**: Node 18+, npm, Vite tooling, and Python 3 (or `python`) so the metadata helper can serialize the `build-metadata.json` audit log. The source tree already ships with `npm run clean`, `npm run type-check`, and `npm run build:ui`, so the `scripts/build-static.sh` orchestrates these steps and copies `dist/ui` into `dist-static` while capturing metadata in `build-metadata.json`.
2. **Command**: Run `npm run build:static` (which invokes `scripts/build-static.sh`). It enforces a fresh clean, runs `npm run type-check` (currently successful), bundles the UI with `NODE_ENV=production`, stages the output directory, and archives it as `dist-static-<timestamp>.tar.gz`. Set `SKIP_TYPE_CHECK=1` only when you need a faster UI-only iteration; the resulting metadata always records the flag so you can tell whether the type-check phase ran.
3. **Reproducible metadata**: The script records timestamps, the ordered commands you actually ran (clean, optional type-check when `SKIP_TYPE_CHECK` is unset, and the Vite build), Node/npm versions, git commit/branch/dirty state, and the `SKIP_TYPE_CHECK` flag so every artifact can be traced back to a single source. Preserve `build-metadata.json` alongside each release bundle to detect drift.
   Ensure Python 3 (or `python`) remains on your PATH so the helper that emits the JSON metadata can run successfully every time.
4. **Archives**: The final tarball lives next to the repo root, ready for transfer. Keep the archive name timestamped (`dist-static-<UTC>.tar.gz`) to prevent accidental reuse and to provide a human-friendly reference in release notes.

## Deployment Targets
| Target | Invocation | Notes |
| --- | --- | --- |
| **S3 bucket/CDN** | `AWS_S3_BUCKET=... AWS_S3_PREFIX=... npm run deploy:static` | Uses `aws s3 sync --delete --exact-timestamps`, accepts `AWS_PROFILE`. CDN cache invalidation is recommended after sync. |
| **Remote host** | `DEPLOY_HOST=host DEPLOY_PATH=/var/www npm run deploy:static` | Runs `rsync -az --delete` over SSH; configure `DEPLOY_USER` if needed. |
| **Local file path** | `DEPLOY_LOCAL_PATH=/srv/daycare npm run deploy:static` | Ideal for staging nodes; mirrors with `rsync -a --delete`.

All targets read from `dist-static/` produced by the build script, so ensure `npm run build:static` ran immediately before deployment. If the directory is missing, the deploy script exits with a clear error prompting a rebuild.

## Configuration Reference
| Variable | Applies to | Purpose |
| --- | --- | --- |
| `SKIP_TYPE_CHECK` | Build | Skip `npm run type-check` when you just need the UI bundle; defaults to `0` and is reflected in `build-metadata.json`. |
| `AWS_S3_BUCKET` | Deploy | Required bucket for CDN rollouts; syncs `dist-static/` into this target. |
| `AWS_S3_PREFIX` | Deploy | Optional bucket prefix (e.g., `prod/2026.02.05`) so you can keep releases separated. |
| `AWS_PROFILE` | Deploy | Forwarded to the AWS CLI so multi-profile teams can target the correct credentials. |
| `DEPLOY_HOST` | Deploy | Remote host that receives the `rsync` sync; must be paired with `DEPLOY_PATH`. |
| `DEPLOY_USER` | Deploy | SSH user for remote hosts; defaults to the current `$USER`. |
| `DEPLOY_PATH` | Deploy | Destination path on the remote host that mirrors `dist-static/`. |
| `DEPLOY_LOCAL_PATH` | Deploy | Local filesystem target for pilots, packaging, or QA copies of the bundle. |

## Build metadata & traceability
`npm run build:static` (which drives `./scripts/build-static.sh`) records every release through `dist-static/build-metadata.json` and the timestamped tarball next to the repo root. The metadata captures:

- `commands`: the ordered commands that executed (`npm run clean`, optionally `npm run type-check` when it didn’t run with `SKIP_TYPE_CHECK=1`, and `npm run build:ui`).
- `versions`: Node/npm tool versions so the environment can be reproduced.
- `vcs`: git `commit`, `branch`, and `dirty` state so auditors know what code produced the bundle.
- `environment`: the resolved `NODE_ENV` and the `skipTypeCheck` flag (true when `SKIP_TYPE_CHECK=1`) so variations in whether the type-check phase ran are explicit.

Keep the metadata file and tarball together with the staged `dist-static/` directory. Before deployment, verify the metadata matches the release you intend to push and note the `generatedAt` timestamp in your release log. When deploying, copy the entire directory (including `build-metadata.json`) to the target so the live environment can be traced back to the archived build. Retain previous tarballs plus their metadata in case a rollback is needed.

## Release Workflow & Governance
1. **Prepare release branch/tag**: Merge the latest compliant work, run `npm run test` (Jest) and `npm run lint` before building so rule coverage is fresh.
2. **Generate release bundle**: `npm run build:static` produces the metadata and tarball. Record the git commit (also in metadata) and append the tarball name to release notes.
3. **Deploy**: Choose the target from the table above. Always sync from the freshly generated `dist-static` tree; avoid copying older archives manually.
4. **Verify**: After deployment, check that `build-metadata.json` is present on the target (copy it alongside the bundle or emit it inside the deployed directory) and keep a copy in release artifacts for auditing.
5. **Sign-off**: Manual acceptance should confirm the UI loads, schedule week data can be edited, and no validation flags persist before considering the release healthy.

## Update & Rollback Considerations
- **Atomic updates**: Sync commands use `--delete` to ensure removed files do not linger. For S3/CDN flows, use `--exact-timestamps` so cache headers stay predictable.
- **Cache invalidation**: CDN fronting buckets should purge or version assets when the release timestamp in `build-metadata` changes. For long-lived caches, bump asset query strings (Vite manifest already hashes filenames) and signal the CDN to drop the old assets after sync completes.
- **Rollback**: Retain previous tarballs (`dist-static-<older>.tar.gz`) and their metadata. To roll back, rebuild staging from the archived tree or re-sync using another tarball's contents, then redeploy via the same `deploy-static.sh` path.
- **Monitoring**: After any update, verify that the `build-metadata.json` timestamp matches the most recent deployment and that `npm run test` still passes locally (the same commands recorded in metadata).

## Automation & Continuous Delivery
- The existing scripts can be wired into a CI pipeline that:
  1. Installs dependencies (`npm ci`),
  2. Runs lint/type check/test,
  3. Executes `npm run build:static`,
  4. Uploads the tarball and metadata to a release storage (e.g., GitHub release assets) and simultaneously triggers `deploy-static.sh` with the desired target environment.
- Keep the `build-metadata.json` artifact archived with each CI run; the deployment automation can compare it against the target directory’s metadata to confirm the correct version is in production.

## Operational Checklist
- [ ] Validate Node/npm versions match the metadata in each release.
- [ ] Confirm `dist-static/` contains `index.html`, hashed chunk files, and `build-metadata.json` before deployment.
- [ ] After deployment, open the UI from its canonical URL and exercise clock-in/out editing plus field-trip selection to ensure the new bundle respects the updated rules.
- [ ] Keep a changelog entry noting the git commit, release timestamp, and deployment target for audit purposes.
