# Technical Reference

## Purpose
This reference explains how the Scheduling workspace hangs together so any engineer, ops lead, or documentation agent can update, verify, or deploy the system without relying on tribal knowledge. It complements the onboarding narrative by spelling out the architecture, data lifecycle, rules execution, and agent coordination that keep the UI compliant.

## Architecture at a Glance
- **Static HTML5 frontend.** `src/ui` contains the guided React workspace built for offline-first delivery; the entry point wires into `index.html` and relies on `vite.config.ts` for build-time asset bundling.
- **Domain layer.** `src/domain` encapsulates entities such as `School`, `Staff`, `Schedule`, `PolicyCitation`, `RatioProfile`, and `Certification`. Business rules—validation hooks, derived booleans, state transitions—reside close to these models.
- **Rules engine.** `src/rules/RulesEngine.ts` orchestrates the compliance checks described in the charter: ratio coverage, certification expiration, break enforcement, field-trip overrides, coverage gaps, substitute parity, and approval gating. The engine exposes `violationRecords` that the UI consumes to render `ViolationNavigator`, the guided tracker, and the publish CTA state.
- **Storage & persistence.** Local storage (IndexedDB snapshots or JSON-based journals) lives under `src/storage`. Every scheduling action produces a journal entry so offline edits can replay, audit trails stay complete, and data can later sync or export.
- **Agent orchestration.** `orchestrate.ts` drives the agent phases, routing specs from `AGENTS.md`, `PROJECT.md`, and `DOMAIN_MODEL.md` into the appropriate outputs (`artifacts/*`). Each phase (Product, Solution, Data Model, etc.) publishes artifacts that downstream agents reference; documentation is the final handoff.

## Core Data Model
These entities appear throughout the docs and the UI:

| Entity | Responsibility |
| --- | --- |
| `PolicyCitation` | Anchors every ratio, certification, and substitute rule to a policy or district section so violations can include citations. |
| `SchoolProfile` / `OperatingHours` | Capture the daycare’s timezone, primary contact, and daily templates. |
| `RatioProfile` / `FieldTripType` | Define children-per-staff ratios, leader requirements, and policy references for both in-house and off-site blocks. |
| `ScheduleWeek` / `SegmentBlock` | Track a week’s life cycle, segment timing, child counts, required staff, and field-trip state. |
| `StaffAssignment` / `ShiftBreak` | Represent who works each block, allow multiple non-contiguous assignments per day, and record break metadata for regulatory enforcement. |
| `Certification` / `AvailabilityWindow` / `Employee` | Drive derived flags (leader-qualified, CPR-current, med delegation) and hard limits (`max_hours_per_day`, `max_hours_per_week`). |
| `SubstituteRequest` / `FieldTripEvent` | Hold approval metadata, parity requirements, and the signatures required before blocks go live. |

Enumerations such as `DayScheduleType`, `DaySegment`, `JobTitle`, `CertificationType`, `AssignmentSource`, `ApprovalState`, and `ShiftStatus` remain centralized in the domain layer so the UI, rules engine, and configuration screens share the same vocabulary.

## Compliance & Validation Flow
- `RulesEngine` runs whenever schedule data changes or approvals progress. It re-evaluates coach coverage, certification requirements, break spacing, ratio minimums, and substitute parity, attaching citations from `PolicyCitation`.
- The guidance panel surfaces `violationRecords` grouped by unresolved, actionable findings. Field trips, substitutes, and guided tracker steps (plan → review → publish) listen to the same selector so blocking states update instantly.
- **Validations clear automatically.** There is no “mark addressed” button. Once the underlying configuration or assignment satisfies the rule, the violation disappears and the workspace advances.

## UI Modules & Guided Workflow
- **ScheduleGrid** (`src/ui/components/ScheduleGrid.tsx`) displays weekly blocks, supports clock-in/clock-out data entry, and allows staff to hold multiple non-contiguous time slices per day. Users drag staff cards from the palette onto segments or rely on the “Auto-select” helper to honor leader/ratio needs.
- **StaffPalette** shows the roster, certifications, availability, and auto-select predictions. Clicking a card pushes that staff member into the focus trail; keyboard shortcuts for the guided steps are documented in `docs/onboarding-guide.md`.
- **ViolationNavigator** lists every outstanding rule with links to the offending segment or certificate. Opening the navigator also highlights the card inside the grid and the status tracker, giving users contextual guidance about what to adjust before publish.
- **Guided Status Tracker** enforces the sequence: prepare staff → assign shifts/field trips → review violations → publish. Each step surfaces blockers derived from the rules engine, the substitution queue, and the field-trip signoff checklist.
- **Configuration panel.** From the web UI users manage employees (contact info, job title, employment status), certifications, availability windows, ratio profiles, and policy citations.

## Persistence, Export, & Audit
- **Local journals.** Every clock-in/clock-out, assignment edit, field trip signoff, or substitute approval emits a journal entry that feeds the audit trail. The UI surface shows timestamps and approver names sourced from those entries.
- **Exports.** Users can generate PDF/CSV exports from the schedule view; exports include ratio calculations, staff certifications, and violation snapshots so auditors can see why a schedule was published.
- **Sync readiness.** While the MVP stores everything locally, the journal/audit APIs were designed so the optional sync layer (future extension) can replay commands against a remote service without re-implementing rules logic.

## Testing & Automation
- **Unit/Integration** frameworks: Jest + React Testing Library. `tests/utils/rulesUtils.test.ts` ensures helper math (e.g., `parseTimeToMinutes`, `calculateDurationHours`) handles wrap-around times and invalid inputs before violations fire. Component specs (`tests/ui/*.test.tsx`) cover guided tracker actions, field-trip approvals, substitute parity, violation navigator controls, and staff palette behaviors.
- **End-to-end**: Playwright scenarios (`tests/e2e/workspace-interactions.spec.ts`) focus on the guided status tracker and staff palette auto-select flows. Currently blocked because the Vite dev server cannot bind to `127.0.0.1:4174` (EPERM); once the port is available rerun `npm run test:e2e`.
- **Execution**: Watch mode is available via `npm test -- --watch`, and `docs/testing-approach.md` documents the QA readiness checklist, automation blockers, and traceability requirements.

## Build & Deployment Commands
| Command | Purpose | Notes |
| --- | --- | --- |
| `npm run dev` | Starts Vite dev server for the UI | Use for local development; 127.0.0.1 binding only until Playwright blocker resolved. |
| `npm run build` | TypeScript + Vite production build | Used before running `npm run build:ui`. |
| `npm run build:ui` | Produces optimized UI bundle (`dist/`) | Relies on Jest/Vite compile of `src/ui`. |
| `npm run build:static` | Stages static assets for deployment (`dist-static/`) | Currently requires `SKIP_TYPE_CHECK=1` due to TypeScript issues in the E2E tests; see `tests/e2e/workspace-interactions.spec.ts:29` for the invalid locator blocker. |
| `npm test` | Runs Jest suites | Requires `jest-environment-jsdom`; install once registry access is available. |
| `npm run test:e2e` | Launches Playwright guided-workflow tests | Blocked until Vite can bind to `127.0.0.1:4174`. |

## Deployment & Ops Notes
- **Static deployment**: Operates as standalone HTML5 assets; `artifacts/phase-9-deployment/deployment-guide.md` and `deployment-checklist.md` contain the release/rollback workflow, verification matrix, and cache-invalidation steps.
- **Build metadata**: `npm run build:static` writes `build-metadata.json` alongside the tarball so operators can trace the CSS/JS versions deployed to each school.
- **Troubleshooting**: If `tsc` flags `hasText` in the Playwright spec or unresolved imports from `tests/ui`, fix the tests first (`hasText` is not a valid locator option) before expecting `npm run build:static` to produce `dist-static/`.

## Next Steps for New Contributors
1. Review `docs/onboarding-guide.md` to understand the user touchpoints before modifying UI components.
2. Run the Jest suites after installing `jest-environment-jsdom` once network access allows (`npm install --save-dev jest-environment-jsdom`).
3. Allow Vite to bind to `127.0.0.1:4174` or change the port in `playwright.config.ts`, then rerun `npm run test:e2e`.
4. Keep the rules catalog synced with `docs/testing-approach.md` so the guided workflow and compliance stories align with the automated suites.
