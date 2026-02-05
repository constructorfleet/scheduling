# Testing approach for the scheduling application

## Purpose
This guide describes how the scheduling app’s automation layers (rule-engine Jest suites, RTL component specs, Playwright journeys, and audit-ready artifacts) keep every policy violation traceable and teachable without a live walkthrough. It also captures the blockers, tools, and next steps the Documentation & QA agents highlight so onboarding leans on the documentation itself.

## Testing philosophy
- **Compliance-first traceability.** Each QA rule listed in `RULES_TEST_CASES.md` links a policy citation to a violation/clean fixture pair in `tests/rules/rulesEngine.test.ts`, so the UI’s violation navigator can point back to the exact rule definition in `src/rules/definitions.ts` and the underlying operating policy.
- **Data-driven revalidation.** There is no “mark addressed” button—`GuidedStatusTracker` guides directors to the unresolved field trip, ratio, or clock block, and the rules engine clears every violation automatically once the submitted metadata is compliant.
- **Auditable automation.** Every Jest or Playwright run creates validation data (`test-results/`) that can be attached to release notes, QA dashboards, or compliance reports, ensuring the same scripts executed in each school deployment produce identical outputs.
- **Offline parity.** The available automation runs locally (Vite dev server + Playwright, Jest with `ts-jest` and `jsdom`), so even air-gapped deployments can execute the same commands and capture JSON/journal snapshots for auditors.

## Guardrail catalog (QA-RULE-017—030)
| QA rule | Coverage | Automated reference |
| --- | --- | --- |
| QA-RULE-017 Field-trip overrides skip base ratios | Ensures field trips enforce their own staffing formulas rather than the standard segment ratios. | `tests/rules/rulesEngine.test.ts` + future Playwright scenario that edits a field-trip sign-off. |
| QA-RULE-018 Weekly totals enforce cross-day ceilings | Warns when daily compliance hides a weekly cap violation. | `tests/rules/rulesEngine.test.ts` (weekly totals fixtures) and planned Playwright coverage for publishing gating. |
| QA-RULE-019 Substitute approvals need metadata | Catches missing approver IDs or timestamps before toggling compliance. | `tests/rules/rulesEngine.test.ts` + `tests/ui/SubstituteAssignmentPanel.test.tsx`. |
| QA-RULE-020 Leader-focused shortages | Keeps leader ratios separate so adult compliance cannot mask leader gaps. | `tests/rules/rulesEngine.test.ts` and `tests/ui/ViolationNavigator.test.tsx` verifying violation cards highlight leader shortages. |
| QA-RULE-021 Partial sign-offs still block publishing | Lists any missing approver detail instead of allowing silent clearance. | `tests/rules/rulesEngine.test.ts` (field-trip sign-off fixtures) and `tests/e2e/violation-workflows.spec.ts` that exercises the guided tracker/violation navigator for incomplete approvals. |
| QA-RULE-029 Segment block windows must be positive | Prevents zero-length or negative-duration segment blocks that hide compliance gaps. | `tests/rules/rulesEngine.test.ts` (`segment-block-timeline` fixtures) + `tests/ui/ClockBlockTimeline.test.tsx` ensuring violation badges appear for invalid windows and the focused block toggles `aria-pressed`. |
| QA-RULE-030 Segment block overlaps are disallowed | Flags overlapping assignments within the same day so auto-balance can reflow staff. | `tests/rules/rulesEngine.test.ts` (overlap fixtures) + `tests/e2e/workspace-interactions.spec.ts` verifying the violation navigator steers directors back to the conflicting blocks. |

### Timeline integrity (QA-RULE-029—030)
- The `segment-block-timeline` rule (see `src/rules/definitions.ts:240-309`) validates every `SegmentBlock` for a positive clock window and no overlaps within its day, producing actionable violations that carry the block metadata for downstream reporting. `RULES_TEST_CASES.md:169-182` keeps the QA-ID/citation pair aligned with the fixtures used in `tests/rules/rulesEngine.test.ts:907-968` so auditors can replay a violation straight from the documentation. 
- Component tests (`tests/ui/DayMetadataStrip.test.tsx`, `tests/ui/ClockBlockTimeline.test.tsx`) and the workspace-focused Playwright journeys ensure the guided metadata flows, auto-balance hints, and `aria-pressed` focus semantics reflect the same rule payloads; new QA-RULE references now appear in the feature/coverage matrix and QA catalog so onboarding scripts can point learners to the exact fixtures and commands. 
- Every rerun of `npm test -- tests/rules/rulesEngine.test.ts` or the narrower `tests/ui/ClockBlockTimeline.test.tsx` suite should capture `test-results/segment-block-timeline.json` (or similar) with the QA rule ID so release notes and compliance decks cite both the policy and automation path before publishing. 

## Automation layers
### Rule engine & helpers (Jest)
- `tests/rules/rulesEngine.test.ts` walks through every QA rule ID, firing compliant and violating fixtures so auditors can replay a violation from the UI back to the policy citation exported alongside `src/rules/definitions.ts`.
- Utility suites such as `tests/utils/rulesUtils.test.ts` protect the shared math helpers (`parseTimeToMinutes`, ratio calculations, clock block duration checks) that keep coverage consistent when block windows span midnight or combine non-contiguous assignments.
- Jest uses `ts-jest`, the `jsdom` environment configured in `jest.config.ts`, and DOM helpers from `tests/setupTests.ts` so the React components and rule engine agree on the same helpers and mocking story.

### Component & guided workspace integration (React Testing Library)
- `tests/ui/GuidedStatusTracker.test.tsx` proves the tracker renders statuses, focuses the relevant card, and never mutates data—it only scrolls directors toward the outstanding violation, and the rules engine clears the violation once their edits are committed.
- `tests/ui/ViolationNavigator.test.tsx` ensures each card highlights all impacted clock blocks, links to the policy metadata, surfaces the leader/adult delta, and never provides a “resolve manually” control.
- Supporting tests (`FieldTripApprovalPanel`, `SubstituteAssignmentPanel`, `StaffPalette`) keep guided panels and selection affordances aligned with the mocked domain state from `src/ui/data/mockScheduleData.ts` and the `ScheduleDay`/`FieldTripEvent` metadata model.
- `tests/ui/DayMetadataStrip.test.tsx` validates each metadata card flags missing enrollment/schedule/field-trip details, surfaces the chosen ratio hint, and dispatches the correct payload per control change.
- `tests/ui/ClockBlockTimeline.test.tsx` exercises the timeline blocks so assigned staff, required-staff/ratio data, and violation badges render, the focused block toggles `aria-pressed`, and the auto-balance/focus callbacks fire when the user interacts.
- These specs run alongside the rule-engine tests via `npm test` or focused commands (e.g., `npm test -- tests/ui`), guaranteeing UI props reflect the same rules as the backend fixtures.

### Guided end-to-end flows (Playwright)
- `tests/e2e/day-metadata-workflows.spec.ts` covers the DayMetadataStrip interactions: showing ratio hints for each schedule type, reflecting field-trip approvals, and re-blocking publish until the director signs off again.
- `tests/e2e/guided-workflows.spec.ts` walks through a full guided week: navigating the workspace, resolving violations, signing off field trips, approving substitutes, and unlocking the publish CTA only when all metadata and approvals are complete.
- `tests/e2e/workspace-interactions.spec.ts` verifies the workspace toolbar hints (“Field trip needs signature”, “Publish blocked”), the violation navigator’s auto-focus, and the auto-select behavior inside the staff palette once a violation has been chosen.
- `tests/e2e/violation-workflows.spec.ts` focuses on the violation navigator and guided tracker so UX reviewers can see the compliance highlight drop to zero only after the rules engine reruns with edited clock blocks or approvals—it confirms there is never a manual dismiss path.
- Playwright reuses `playwright.config.ts`, which currently expects `http://127.0.0.1:4174`; retained traces/screenshots unlock root-cause debugging when runs fail offline.

## Running the suites
1. Use Node 18+ to match the `engines` declaration in `package.json`; `nvm use 18` or a similar tool should be part of any onboarding script.
2. Install dependencies (`npm install`) whenever `package-lock.json` or the repo changes.
3. Rule-engine and helper Jest suites:
   - `npm test` for the full Jest surface area.
   - `npm test -- tests/rules/rulesEngine.test.ts tests/utils/rulesUtils.test.ts` to focus on policy and helper math coverage.
   - `npm test -- tests/ui` for guided-workspace component specs; watch for the `jsdom` dependency listed under blockers.
   - `npm run test:watch` for rapid iteration while editing rules or component props.
4. End-to-end:
   - `npm run test:e2e` (once the Vite dev server can bind to `127.0.0.1:4174` or the host/port is adjusted); specify individual specs (e.g., `tests/e2e/day-metadata-workflows.spec.ts`, `tests/e2e/violation-workflows.spec.ts`) to target focused journeys.
5. `npm run build:ui` before each release to ensure Vite’s `dist/` artifacts (and `dist-static/` later) reflect the latest metadata-driven workspace.
6. Archive the generated logs/artifacts under `test-results/` (create the folder if missing) so compliance reviewers can match violation IDs to actual runs.

## Maintaining and expanding coverage
- When adding or revising a QA rule, update `RULES_TEST_CASES.md` (policy citation + QA ID), extend `tests/rules/rulesEngine.test.ts` with violation/clean fixtures, and reflect the same QA ID in any relevant component or Playwright spec.
- Guardrail updates (e.g., new field-trip overrides, leader-only shortages, substitute metadata requirements) should live in this doc’s catalog plus any new table rows in `artifacts/phase-4-testing/rules-test-plan.md` so every agent sees where enforcement sits.
- Capture failing runs in `test-results/` with the QA rule references used during that execution so release notes can mention the exact policy IDs.
- Flag automation gaps immediately: missing helper coverage, new UI flows that are not yet automated, or Playwright specs that cannot run because the Vite host is blocked.

## Traceability & documentation
- QA rules, policy citations, and fixture pairings live in `RULES_TEST_CASES.md`; linking a new rule there ensures the story propagates to `tests/rules/rulesEngine.test.ts` and the `ViolationNavigator` metadata found in `src/ui/components/ViolationNavigator.tsx`.
- Reference artifacts such as `artifacts/phase-4-testing/rules-test-plan.md` and `docs/technical-overview.md` for policy intent, rule mappings, and command sequences that reproduce every layer.
- Mention the QA rule IDs inside Playwright reports (custom trace names, screenshot filenames) so operations can batch discover failing policies without parsing logs.

## Blockers & immediate actions
| Blocking area | Impact | Next action |
| --- | --- | --- |
| `jest-environment-jsdom` missing | `npm test -- tests/ui` fails because the DOM environment does not exist | Install `jest-environment-jsdom` once the registry is reachable: `npm install --save-dev jest-environment-jsdom`; rerun the focused suites. |
| Playwright host binding (`listen EPERM 127.0.0.1:4174`) | `npm run test:e2e` cannot launch the Vite dev server, so guided workflows and violation navigator journeys never execute | Allow binding to `127.0.0.1:4174` or update `playwright.config.ts`/`npm run dev` to use an allowed host/port (e.g., `0.0.0.0` or a non-privileged port) and rerun each spec. |
| Manual validation resolution | The UI must never provide a manual “mark resolved” button, so testers must expect violations to clear only after data edits | Keep `GuidedStatusTracker` focused on directing directors to the violation and adjust Playwright assertions to await the rules engine revalidation instead of the tracker action. |

## QA readiness checklist
1. Document each new QA rule + citation in `RULES_TEST_CASES.md` so the story feeds both the rules engine and the frontend metadata.
2. Pair new rules with violation/clean fixtures in `tests/rules/rulesEngine.test.ts`; keep the QA ID next to each describe block.
3. Cover the updated flows in `tests/ui/*` (guided tracker, violation navigator, field-trip approvals, substitute panels) so the components reflect the same metadata.
4. Expand Playwright coverage (`tests/e2e/*.spec.ts`) for the new journeys described in this doc (day metadata, violation navigator, guided workspace gating, workbook interactions).
5. Capture any failing runs in `test-results/` and note the QA rule IDs in release notes or QA dashboards before releasing a schedule week.

## Execution status snapshot
| Suite | Command | Scope | Status | Notes |
| --- | --- | --- | --- | --- |
| Rule engine + helpers (Jest) | `npm test -- tests/rules/rulesEngine.test.ts tests/utils/rulesUtils.test.ts` | Ratio/coverage/field-trip metadata guards; helper math | Blocked | Awaiting `jest-environment-jsdom` so DOM-based helpers and component imports resolve. |
| Component integrations (RTL) | `npm test -- tests/ui` | Guided tracker, violation navigator, field trip approval, staff palette | Blocked | Same DOM dependency; rerun after environment is installed. |
| End-to-end (Playwright) | `npm run test:e2e` | Guided flows (day metadata, violation navigator, staff palette, publish gate) | Blocked | Vite dev server cannot bind to `127.0.0.1:4174`; adjust host/port or permissions. |
| Static UI build | `npm run build:ui` | Bundles React app for offline deployment | Not run | Run before every release. |

> Validations clear only when the actual data passes the rules engine; there is no manual “mark resolved” override.

## Next steps
1. Install `jest-environment-jsdom` once registry access is restored and rerun `npm test -- tests/rules/rulesEngine.test.ts tests/ui` so the DOM-based suites pass.
2. Allow Playwright’s Vite server to bind to `127.0.0.1:4174` (or switch to an approved host/port) and rerun `npm run test:e2e` so the guided-workflow and violation-spec assertions execute in a browser.
3. Once the workspace supports editable/persistent schedule blocks and approvals, expand Playwright coverage to include every QA-RULE-017—021 journey before allowing a week to publish.
4. Keep `docs/testing-approach.md` aligned with `RULES_TEST_CASES.md` and `artifacts/phase-4-testing/rules-test-plan.md` so new guardrails stay documented for onboarding.
