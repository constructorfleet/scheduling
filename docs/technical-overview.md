# Technical Reference

## Purpose
This reference explains how the Scheduling workspace hangs together so any engineer, ops lead, or documentation agent can update, verify, or deploy the system without relying on tribal knowledge. It complements the onboarding narrative by spelling out the architecture, data lifecycle, rules execution, and agent coordination that keep the UI compliant.

## Architecture at a Glance
- **Static HTML5 frontend.** `apps/ui` contains the guided React workspace; the entry point wires into `index.html` and relies on `vite.config.ts` for build-time asset bundling.
- **Domain layer.** `packages/core/domain` encapsulates entities such as `School`, `Employee`, `ScheduleWeek`, `PolicyCitation`, and `FieldTripType`. Business rules—validation hooks, derived booleans, state transitions—reside close to these models.
- **Rules engine.** `packages/core/rules/definitions.ts` orchestrates compliance checks for ratio coverage, certification flags (CPR/medical delegation), field-trip overrides, coverage gaps, and availability. The engine exposes `violationRecords` that the UI consumes to render `ViolationNavigator`, the guided tracker, and publish gating.
- **API & persistence.** `apps/api/src/server.ts` exposes Fastify endpoints backed by Prisma + Postgres. The UI autosaves schedule weeks via `PUT /api/schedule/{weekId}` and persists audit events alongside schedule data.
- **Undo/redo history.** The UI maintains undo/redo stacks in browser storage per week so refreshes retain the history; audit events are still persisted server-side.
- **Agent orchestration.** `orchestrate.ts` drives the agent phases, routing specs from `AGENTS.md`, `PROJECT.md`, and `DOMAIN_MODEL.md` into the appropriate outputs (`artifacts/*`). Each phase (Product, Solution, Data Model, etc.) publishes artifacts that downstream agents reference; documentation is the final handoff.

## Core Data Model
These entities appear throughout the docs and the UI:

| Entity | Responsibility |
| --- | --- |
| `PolicyCitation` | Anchors ratio, certification, and compliance rules to a policy section for violation citations. |
| `School` / `OperatingHours` | Capture school-level settings (open/close windows, field trip window, staffing minimums). |
| `ScheduleType` / `FieldTripType` | Define children-per-staff ratios and policy references for in-house and off-site blocks. |
| `ScheduleWeek` / `ScheduleDay` / `SegmentBlock` | Track a week’s life cycle, day metadata, segment timing, and child counts. |
| `StaffAssignment` | Represents who works each block and allows multiple non-contiguous assignments per day. |
| `Employee` / `JobTitle` | Drive derived flags (leader-qualified, CPR-current, medical delegation) and hour limits (`max_hours_per_day`, `max_hours_per_week`). |
| `FieldTripEvent` / `AuditEvent` | Hold field trip decisions, approvals, and audit trail entries for schedule changes. |

Enumerations such as `DayScheduleType`, `DaySegment`, `JobTitle`, `CertificationType`, `AssignmentSource`, `ApprovalState`, and `ShiftStatus` remain centralized in the domain layer so the UI, rules engine, and configuration screens share the same vocabulary.

## Compliance & Validation Flow
- `RulesEngine` runs whenever schedule data changes or approvals progress. It re-evaluates coach coverage, certification requirements, break spacing, ratio minimums, and substitute parity, attaching citations from `PolicyCitation`.
- The guidance panel surfaces `violationRecords` grouped by unresolved, actionable findings. Field trips, substitutes, and guided tracker steps (plan → review → publish) listen to the same selector so blocking states update instantly.
- **Validations clear automatically.** There is no “mark addressed” button. Once the underlying configuration or assignment satisfies the rule, the violation disappears and the workspace advances.

## UI Modules & Guided Workflow
- **ScheduleMatrix** (`apps/ui/components/ScheduleMatrix.tsx`) displays weekly blocks, supports clock-in/clock-out data entry, and allows staff to hold multiple non-contiguous time slices per day. Users add blocks, edit times, and use Auto Schedule to seed coverage.
- **ViolationNavigator** lists every outstanding rule with links to the offending segment. Opening the navigator highlights the related grid area to guide fixes before publish.
- **Guided Status Tracker** enforces the sequence: prepare staff → assign shifts/field trips → review violations → publish. Each step surfaces blockers derived from the rules engine and approval states.
- **AuditTimeline** shows schedule edits and supports undo/redo of recent changes.
- **Configuration panel.** From the web UI users manage employees (job title, employment status, CPR/medical delegation flags), availability windows, schedule types, field trip ratios, and operating hours.

## Persistence, Export, & Audit
- **Schedule persistence.** The UI autosaves schedule weeks to the API (`PUT /api/schedule/{weekId}`), which stores schedule days, segment blocks, staff assignments, field trip events, and audit events in Postgres.
- **Audit log.** Every edit emits an audit event that is persisted with the schedule week and rendered in the Audit Timeline.
- **Undo/redo.** Undo/redo history is stored in browser storage per week to survive refreshes; it does not replace the server-side audit trail.
- **Exports.** Users can generate PDF/CSV exports from the schedule view; exports include ratio calculations, staff coverage, and violation snapshots so auditors can see why a schedule was published.

## Testing & Automation
- **Unit/Integration** frameworks: Jest + React Testing Library. `tests/utils/rulesUtils.test.ts` ensures helper math (e.g., `parseTimeToMinutes`, `calculateDurationHours`) handles wrap-around times and invalid inputs before violations fire. Component specs (`tests/ui/*.test.tsx`) cover guided tracker actions, field-trip approvals, substitute parity, violation navigator controls, and staff palette behaviors.
- **End-to-end**: Playwright scenarios (`tests/e2e/workspace-interactions.spec.ts`) focus on the guided status tracker and staff palette auto-select flows. Currently blocked because the Vite dev server cannot bind to `127.0.0.1:4174` (EPERM); once the port is available rerun `npm run test:e2e`.
- **Execution**: Watch mode is available via `npm test -- --watch`, and `docs/testing-approach.md` documents the QA readiness checklist, automation blockers, and traceability requirements.

## Build & Deployment Commands
| Command | Purpose | Notes |
| --- | --- | --- |
| `npm run dev` | Starts Vite dev server for the UI | Use for local development; 127.0.0.1 binding only until Playwright blocker resolved. |
| `npm run build` | TypeScript + Vite production build | Used before running `npm run build:ui`. |
| `npm run build:ui` | Produces optimized UI bundle (`dist/`) | Relies on Jest/Vite compile of `apps/ui`. |
| `npm run build:static` | Stages static assets for deployment (`dist-static/`) | Runs the clean → optional type-check → Vite build pipeline, stages `dist-static/`, captures `build-metadata.json` (including the ordered `commands` array and `skipTypeCheck` flag), and emits `dist-static-<timestamp>.tar.gz`. `SKIP_TYPE_CHECK=1` is only needed for quick UI iterations and the chosen flag is recorded in the metadata for traceability. |
| `npm test` | Runs Jest suites | Requires `jest-environment-jsdom`; install once registry access is available. |
| `npm run test:e2e` | Launches Playwright guided-workflow tests | Blocked until Vite can bind to `127.0.0.1:4174`. |

## Deployment & Ops Notes
- **Static deployment**: Operates as standalone HTML5 assets; `artifacts/phase-9-deployment/deployment-guide.md` and `deployment-checklist.md` contain the release/rollback workflow, verification matrix, and cache-invalidation steps.
- **Build metadata**: `npm run build:static` writes `build-metadata.json` alongside the tarball so operators can trace the CSS/JS versions deployed to each school.
- **Troubleshooting**: If `tsc` raises Playwright or UI test errors (unsupported locator options, missing imports, or failing mocks), resolve those failures before expecting `npm run build:static` to produce `dist-static/`. The metadata's `commands` array and `skipTypeCheck` flag show which phases executed so you can correlate a failing staging run with the test suite (or the skipped type-check) that originally triggered it.

## Next Steps for New Contributors
1. Review `docs/onboarding-guide.md` to understand the user touchpoints before modifying UI components.
2. Run the Jest suites after installing `jest-environment-jsdom` once network access allows (`npm install --save-dev jest-environment-jsdom`).
3. Allow Vite to bind to `127.0.0.1:4174` or change the port in `playwright.config.ts`, then rerun `npm run test:e2e`.
4. Keep the rules catalog synced with `docs/testing-approach.md` so the guided workflow and compliance stories align with the automated suites.
