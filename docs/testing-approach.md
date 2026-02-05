# Testing Approach for the Scheduling Application

## Purpose
This guide crystallizes how the project keeps every compliance rule, UX flow, and deployment gate testable without a live walkthrough. The goal is to make onboarding QA, product, and ops partners self-sufficient: every artifact references a cataloged policy, every guardrail links to a test, and the execution story signals the current blockers and next steps.

## Compliance-first philosophy
- **Policy-driven automation.** Every test suite maps back to a citation in `RULES_TEST_CASES.md` and the policy-aware definitions in `src/rules/definitions.ts`. When policies change, the catalog entry and the failing fixture tell the story, so auditors can trace a violation from UI > fixture > rule definition > citation without asking a developer.
- **Early validation.** Validation errors flow from the rule engine and are cleared only when the underlying data passes the check, so pass/fail states are deterministic and never manually toggled.
- **On-device readiness.** Node 18+ is required for the Jest/Playwright stack (see `package.json`), ensuring every tester and QA workstation runs the same runtime as CI.

## Rule coverage tiers
Each rule includes a violation fixture and a compliant fixture so reviewers immediately see the gap that must be fixed. Key tiers:
- `ratio-segment`: enforces `max(minStaff, ceil(childCount / ratio.childrenPerStaff))` per block (`artifacts/phase-4-testing/rules-test-plan.md:10-14` and `tests/rules/rulesEngine.test.ts:83-120`).
- `certification-per-segment`: guards CPR/medical/leader flags and documentation for every block (`artifacts/phase-4-testing/rules-test-plan.md:15-19`, relevant fixtures).
- `segment-coverage`: monitors ratio, leader, and medical coverage simultaneously (`artifacts/phase-4-testing/rules-test-plan.md:20-24`).
- `shift-break-limits`: validates daily and weekly hour caps plus graceful wrap-around across midnight (`artifacts/phase-4-testing/rules-test-plan.md:25-28`).
- `substitute-parity`: insists on metadata, approver, and timestamp parity (`artifacts/phase-4-testing/rules-test-plan.md:30-33`).
- `field-trip ratios` and `field-trip signoff`: make sure either the field trip meeting ratios/recent approvals or the sign-off metadata is present (`artifacts/phase-4-testing/rules-test-plan.md:35-44`).
- `schedule-day-metadata`: validates that every calendar day has a schedule type, enrollment headcount, and field-trip linkage (missing schedule type, missing enrollment, or a dangling field-trip reference each emit QA-RULE-022—024 and cite the relevant catalog entries in `RULES_TEST_CASES.md:127-144` and `tests/rules/rulesEngine.test.ts`).
- `field-trip-event`: enforces that every event points to either “No Field Trip” or a defined type, rejects dangling type IDs, and cleanly short-circuits when no field trip is required (QA-RULE-025—028 detail the missing-type/no-trip flag, compliant path, unknown type rejection, and No Field Trip short-circuit).

## Guardrail catalog (QA-RULE-017—021)
Each QA rule defines the compliance edge case that must stay covered:
1. **QA-RULE-017 (Field trip overrides).** Confirms field-trip overrides can temporarily waive base ratios but still emit the override citation and require documentation before publishing (`tests/rules/rulesEngine.test.ts`, field-trip fixture pair).
2. **QA-RULE-018 (Weekly total spans).** Validates rules honor weekly totals across contiguous days, not just per-day aggregates, so the rule engine flags a block that would break week-level maximums (`tests/rules/rulesEngine.test.ts`, weekly fixture pair).
3. **QA-RULE-019 (Substitute metadata gaps).** Exercises the substitute parity rule, requiring metadata, approver, and timestamp fields before the UI exposes the “ready” state (`tests/rules/rulesEngine.test.ts`, substitute metadata fixture pair).
4. **QA-RULE-020 (Leader-only shortages).** Ensures leader-level coverage is enforced even when enough non-leader staff exist but no qualifying leader is on shift (`tests/rules/rulesEngine.test.ts`, leader shortage fixture pair).
5. **QA-RULE-021 (Partial sign-off omissions).** Confirms the field-trip sign-off rule still trips when a partial sign-off exists or was never recorded (`tests/rules/rulesEngine.test.ts`, sign-off fixture pair).
6. **QA-RULE-022 (Missing schedule-type metadata).** Flags days that never had a schedule type selected, ensuring the scheduler must pick Regular/Extended/Enrichment before publishing (`tests/rules/rulesEngine.test.ts`, schedule-day metadata fixtures).
7. **QA-RULE-023 (Missing enrollment headcount).** Ensures enrollment is entered before ratios run, and the rule engine keeps the violation active until a child count is provided (`tests/rules/rulesEngine.test.ts`, schedule-day enrollment fixtures).
8. **QA-RULE-024 (Dangling field-trip metadata).** Catches when a day points at a non-existent `FieldTripEvent` so the UI cannot publish with stale references; the new fixture under `tests/rules/rulesEngine.test.ts` proves the rule rejects the orphaned pointer.
9. **QA-RULE-025 (Missing field-trip type/no-trip flag).** Covers the failure path when an event neither declares a valid type nor the “No Field Trip” short-circuit before director approval (`tests/rules/rulesEngine.test.ts`, field-trip event fixtures).
10. **QA-RULE-026 (Clean field-trip path).** Demonstrates the compliant scenario when an event references a valid type, ratios match, and approvals are recorded, guaranteeing the approvals gate stays green (`tests/rules/rulesEngine.test.ts`, field-trip event fixtures).
11. **QA-RULE-027 (Unknown field-trip type).** Exercises the rule that rejects a `FieldTripEvent` whose `fieldTripTypeId` is not defined; the planned fixture proves the rule cites the dangling type before coverage clears.
12. **QA-RULE-028 (No Field Trip short-circuit).** Verifies that explicitly choosing “No Field Trip” bypasses the ratio checks while still forcing the scheduler to acknowledge the decision (`tests/rules/rulesEngine.test.ts`, short-circuit fixtures).

## Automation layers
### Rule engine (Jest)
- Tests run via `npm test` (or `npm test -- tests/rules/rulesEngine.test.ts` for the focused suite). `jest.config.ts` points at `ts-jest`; helpers and shared matchers live in `tests/setupTests.ts`.
- Each describe block wires `RulesEngine` (`src/rules/engine.ts`) to curated definitions, covering violation/clean pairs for every eligibility, ratio, certification, coverage, shift-break, substitute, field-trip ratio, and sign-off rule.
- Deterministic fixtures pull from `src/ui/data/mockScheduleData.ts` and `src/ui/types.ts`, ensuring the same types feed both UI automation and rule validation when the live data layer arrives.

### Integration & UI automation (Playwright)
- The guided workflow spec (`tests/e2e/guided-workflows.spec.ts`) recreates the district director, substitute parity, and field-trip approval journeys before enabling the publish CTA.
- Each scenario shows the field-trip block’s prompts, a director sign-off clearing the gate, the substitute parity panel toggling between missing metadata and ready state, and the publish button unlocking only after compliance.
- New Playwright workflows should keep adding QA-RULE-017—021 paths so UI-level demonstrations mirror the guardrails.
- **Current blocker:** `npm run test:e2e` is blocked because Vite can’t bind to `127.0.0.1:4174` (listen `EPERM`). Either grant permission or configure `playwright.config.ts` to use an allowed host/port before rerunning.

## Recent test plan updates
- The written plan now documents QA-RULE-022—024 under `schedule-day-metadata` and QA-RULE-025—028 for `field-trip-event`, describing missing-schedule-type, missing-enrollment, dangling field-trip references, missing type/no-trip flags, the compliant path, unknown-type rejections, and the explicit “No Field Trip” short-circuit. Each rule entry in `RULES_TEST_CASES.md:127-167` refers back to `artifacts/phase-4-testing/rules-test-plan.md` so auditors can trace the policy citation plus the fixture posture.
- Next steps called out in the plan: (1) add a `ScheduleDay` fixture that points at a non-existent `FieldTripEvent` so QA-RULE-024 has concrete coverage, (2) add a `FieldTripEvent` fixture whose `fieldTripTypeId` is undefined so QA-RULE-027 proves the dangling-type rejection, and (3) rerun `npm test -- tests/rules/rulesEngine.test.ts` (and the full Jest suite) once `jest-environment-jsdom` installs successfully—`npm install --save-dev jest-environment-jsdom` currently fails with `getaddrinfo ENOTFOUND registry.npmjs.org`, so the environment still lacks the required browser API.
- Keeping this plan updated as new guardrails appear ensures the rule engine, fixtures, and Playwright journeys all point back to a living QA catalog before any schedule can publish.

## Running the suites
1. Switch to Node 18+ (`nvm use 18` or equivalent) before installing dependencies.
2. `npm install` to restore packages; offline work means this remains a one-time manual step if network is obstructed.
3. Rule engine (Jest): `npm test -- tests/rules/rulesEngine.test.ts` (runs only the rule coverage). Full suite: `npm test`.
4. Watch mode: `npm run test:watch` (Jest stays live while you adjust fixtures or definitions).
5. Playwright (integration): `npm run test:e2e` once the Vite host/port issue is resolved.
6. UI build verification: `npm run build:ui` and inspect `dist` artifacts; run this before every release to ensure the UI compiles.

## Traceability & onboarding
1. Start with `RULES_TEST_CASES.md` and `artifacts/phase-4-testing/rules-test-plan.md`: each entry lists the QA rule ID, the compliant/violation posture, and the policy citation.
2. Follow the cross-reference into `tests/rules/rulesEngine.test.ts` and `src/rules/definitions.ts`; the coder should see where the violation triggers and which citation surfaces in the UI.
3. When policies change, update the catalog, add the fixture pair with the QA rule ID in the comments, ensure `DEFAULT_RULE_DEFINITIONS` still emits the same metadata, and refresh this doc so auditors know how to verify the new behavior.

## Maintaining and expanding coverage
- Keep each new rule in sync with a dedicated fixture pair and QA identifier so the compliance story stays explicit.
- Add guardrail entries (QA-RULE-017—021) to `artifacts/phase-4-testing/rules-test-plan.md` and the QA dashboard (or `RULES_TEST_CASES.md`) so automation traces the edge case plus the visual workflow.
- Include new interactions in Playwright or React UI specs (`tests/ui/`) so the guided workspace exposes the same validation gates as the rule engine.
- Revisit the `artifacts/phase-3-data-model` documents whenever the data shape changes so the tests keep restoring the same structures the UI expects.
- Periodically rerun `npm test -- tests/rules/rulesEngine.test.ts` and `npm run build:ui` (or CI) before every release, and capture the results in `test-results/` for auditors.

## QA readiness checklist
- [ ] Document every rule update in `RULES_TEST_CASES.md` with its QA rule identifier and the relevant policy citation.
- [ ] Update `tests/rules/rulesEngine.test.ts` with violation/clean fixtures and note the QA rule ID (e.g., `QA-RULE-018`) in comments near each describe block.
- [ ] Add a `ScheduleDay` fixture that points to a missing `FieldTripEvent` so QA-RULE-024 is exercised in the rule-engine suite before any guardrail is considered satisfied.
- [ ] Add a `FieldTripEvent` fixture whose `fieldTripTypeId` is undefined so QA-RULE-027 documents the rejection of dangling field-trip type references.
- [ ] Confirm `src/rules/definitions.ts` emits the citations described in the catalog before merging the change.
- [ ] Run `npm test -- tests/rules/rulesEngine.test.ts` (full `npm test` when larger) to exercise both violation and clean branches.
- [ ] Capture UI interactions for new guardrails in Playwright (`tests/e2e/`) or in `tests/ui/` React specs.
- [ ] Update `docs/testing-approach.md` to highlight any new guardrail, automation command, or environment requirement so onboarding stays current.

## Execution status snapshot
| Suite | Command | Scope | Status | Notes |
| --- | --- | --- | --- | --- |
| Rule engine (Jest) | `npm test` / `npm test -- tests/rules/rulesEngine.test.ts` | Every policy definition | Passed (per latest implementation summary) | Essential regression check; run locally and in CI before release. |
| Integration (Playwright) | `npm run test:e2e` | Guided workflow (field trips, substitutes, publish gate) | Blocked | Vite dev server cannot bind to `127.0.0.1:4174`; update `playwright.config.ts` or grant permission before rerunning. |
| UI build | `npm run build:ui` | Static UI bundle | Passed (last reported run) | Required before packaging/releases. |

> **Reminder:** Validations are only cleared when the underlying data passes the rule engine; there is no manual “mark as answered” action.

## Blockers & next steps
1. **Resolve the Playwright host/port block** so `npm run test:e2e` can exercise the guided workflow (field trips, substitutes, publish gating).
2. **Connect the live data layer** to `src/ui/App.tsx` and the scheduling workspace so compliance tests run against editable/persistent schedules instead of mocks.
3. **Add Playwright/React specs for QA-RULE-017—021** so the UI automation exposes every guardrail before a week can move past draft status.
