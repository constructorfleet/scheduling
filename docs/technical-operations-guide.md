# Technical Operations Guide

## Purpose
This reference gives engineers, ops leads, and documentation owners the ground truth for how the scheduling workspace enforces compliance, keeps timeline data honest, and reports violations without requiring live training. It translates the guided UI flows into an operational checklist that mirrors the automation suites so every new feature ships with clear verification steps.

## Data and compliance flow
1. **Configuration updates** (employees, certifications, ratios) flow through the gear icon into `ScheduleWeek` and `RatioProfile` objects. Each change fires the rules engine so you always see the current blockers in the Guided Status Tracker and Violation Navigator.
2. **Schedule building** stages staff assignments (`StaffAssignment`, `SegmentBlock`, `ShiftBreak`) with multiple non-contiguous blocks per day. Every block records clock-in/clock-out timestamps (any `HH:MM AM/PM` within the operating hours) so overtime, break spacing, and max-hours rules can act on real time boundaries.
3. **Rules execution** (`RulesEngine`) ingests the domain model (ratios, field trips, substitutes, certifications) and emits `ViolationRecord`s tagged with `PolicyCitation`. Violations clear only when the data actually satisfies the rule—there is no manual “address” toggle.
4. **Guided UI** (Status Tracker + Violation Navigator + Timeline) reads the violation set, highlights blockers, and prevents Publish until approvals (field trips, substitutes) and coverage needs resolve.

## Day metadata & timeline interactions
- The **Day Metadata strip** contains the enrollment, schedule type, and field-trip dropdowns that bootstrap every guided workflow. RTL coverage (`tests/ui/DayMetadataStrip.test.tsx`) ensures missing fields show the required badge, ratio hints surface correctly, and every handler sends the expected payload so the workspace can react programmatically.
- Each **timeline block** now carries descriptive day/time labels, `aria-pressed` focus indicators, violation badges, and `onFocus`/`autoBalance` callbacks. `tests/ui/ClockBlockTimeline.test.tsx` verifies those hooks, the violation display, and the behavior when users focus or trigger auto-balance actions so Playwright locators and the automation helpers rely on solid semantics.
- The guided workflows start from the Day Metadata heading, exercise a Friday card for field-trip re-blocking, and assert that validation statuses plus auto-balance highlights behave before Publish is enabled (`tests/e2e/day-metadata-workflows.spec.ts`, `tests/e2e/guided-workflows.spec.ts`, `tests/e2e/workspace-interactions.spec.ts`).

## Guardrails & verification matrix
The QA rule catalog (QA-RULE-017 through QA-RULE-030) lives in `docs/testing-approach.md`. The Timeline Integrity section specifically maps the `segment-block-timeline` policies to their fixtures, RTL suites, Playwright journeys, and the compliance traceability matrix. Keep this checklist synced with `RULES_TEST_CASES.md` and `artifacts/phase-4-testing/rules-test-plan.md` so every violation can be traced to code/tests.

### Quick reference
| Focus area | Technical anchor | Verification suite |
| --- | --- | --- |
| Metadata controls | `DayMetadataStrip` (enrollment, schedule type, field trip selectors) | `tests/ui/DayMetadataStrip.test.tsx` |
| Timeline enforcement | `ClockBlockTimeline` (multiple blocks, violation badges, focus state) | `tests/ui/ClockBlockTimeline.test.tsx` |
| Violations + navigator | `RulesEngine` → `ViolationNavigator` | `tests/e2e/violation-workflows.spec.ts`, guided workflow specs |
| Publish gating | `Guided Status Tracker` steps + approvals | `tests/e2e/guided-workflows.spec.ts` |

### Operating hours guardrail enforcement
`ClockBlockTimeline` runs guardrail checks in the add-block form before any data reaches the rules engine (`apps/ui/components/ClockBlockTimeline.tsx:125-337`), and the timeline columns draw the green overlay and badge wherever `operatingHoursByDay` supplies an open/close window (`apps/ui/components/ClockBlockTimeline.tsx:351-528`). The form rejects blocks when the red error `Clock block must stay within operating hours (X–Y).` pops up, `Save clock block` stays disabled until start < end and inside the overlay, and the new block renders with a ratio summary so you can tell at a glance whether it satisfied the leader ratio plus guardrail.

`ViolationNavigator` surfaces the same guardrail metadata (the `operatingHoursId` payload) so the “Operating hours guardrail” badge appears alongside every timing violation and the “Jump to block” action lands the focus back on the timeline (`apps/ui/components/ViolationNavigator.tsx:64`). Because the navigator and guided tracker share the violation stream, guardrail issues stay under Review until the timeline edit clears the rule—there is no manual “addressed” toggle.

On the rules side, `segmentBlockTimelineRule` ensures every block stays within the configured window and records metadata about the violated operating hours (`src/rules/definitions.ts:269-381`). Violations for starts earlier than open or ends later than close attach `operatingHoursId`, and clearing the violation requires editing the clock block so it falls back inside that window. Overlapping block detection lives in the same rule, so you never need to coordinate two different checks while editing.

### Guardrail validation coverage & automation
- **Unit/RTL**: `tests/ui/ClockBlockTimeline.test.tsx` exercises missing start/end inputs, start ≥ end, guardrail errors, child-count clamping, and the green overlay; `tests/ui/ViolationNavigator.test.tsx` verifies the metadata badge; `tests/ui/GuidedStatusTracker.test.tsx` ensures the Review step stays blocked while violations exist; `tests/rules/rulesEngine.test.ts:991` asserts that guardrail violations carry `operatingHoursId` and clear once the block moves inside the bounds.
- **Integration**: Rendering `App` and calling `handleAddClockBlock` (`apps/ui/App.tsx:286`) together should mutate `segmentBlocksState`/`staffAssignmentsState`, rerun the rule engine (`apps/ui/App.tsx:128`), and feed `violationRecords` plus `GuidedStatusTracker` so guardrail violations drop from the navigator when expectations align. Use the weekday mock data (`apps/ui/data/mockScheduleData.ts:263`) that already includes non-contiguous Monday blocks, add an in-window block, confirm the timeline renders the new segment, the guardrail badge disappears, and the tracker steps turn “Complete.”
- **End-to-end**: Extend the Playwright suites (`tests/e2e`) with flows that cover:
  1. Attempting to save a block whose start is before open or end is after close—it should render the red guardrail message, keep `Save` disabled, and leave the violation active.
  2. Adding a valid block (filled HH:MM inputs, child count, and optional staff) so the timeline shows the new segment, the navigator drops the guardrail entry, and the guided tracker validation row reflects completion.
  3. Observing the green overlay while multiple non-contiguous blocks remain on a single day so that segment handling and guardrail highlighting stay in sync.

- **Scripted sweeps**: Consider adding `test:guardrails` to `package.json` that chains the targeted Jest invocations above (`tests/ui/ClockBlockTimeline.test.tsx`, `tests/ui/GuidedStatusTracker.test.tsx`, `tests/ui/ViolationNavigator.test.tsx`, `tests/rules/rulesEngine.test.ts:991`) so compliance sweeps stay fast. Run them via `npm run test:guardrails` or the equivalent `npm test -- <filenames>`.

- **Dependency note**: Guardrail specs rely on DOM rendering (`ClockBlockTimeline`, `ViolationNavigator`, `GuidedStatusTracker`), so install `jest-environment-jsdom` in devDependencies before executing the suites—without it, `jest` cannot resolve the environment and these tests fail.

## Automation & operational checklist
1. **Jest suites**: `npm test -- tests/ui/DayMetadataStrip.test.tsx tests/ui/ClockBlockTimeline.test.tsx` verifies every metadata handler and the timeline focus/violation hooks. Install `jest-environment-jsdom` (or add it to devDependencies) before running—without it, Jest cannot mount the DOM. The registry is currently unreachable (`getaddrinfo ENOTFOUND`), so restore network access before rerunning.
2. **Playwright e2e**: `tests/e2e/day-metadata-workflows.spec.ts`, `guided-workflows.spec.ts`, `workspace-interactions.spec.ts`, and `violation-workflows.spec.ts` track the guided flow, field-trip re-blocking, and live violation navigator. These specs stall right now because the Vite dev server cannot bind to `127.0.0.1:4174` (`listen EPERM`). Fix the binding (or point `playwright.config.ts` to an allowed host/port) before rerunning `npm run test:e2e`.
3. **CI readiness**: Run `npm run build:static` with `SKIP_TYPE_CHECK=0` once the outstanding TypeScript/test issues are resolved so the generated `build-metadata.json` captures the full clean → type-check → build sequence. Use this metadata in release verifications (`artifacts/phase-9-deployment/deployment-guide.md`).

## Troubleshooting & next steps
- If violations persist after edits, confirm that the rules engine sees the updated clock-in/out times (all times are part of the block object) and the right ratio profile. Clock-time mismatches are the most common reason validations stay active.
- The guided tracker uses icons (clock, badge, shield) to explain why steps are blocked—include those details in any support ticket so engineers can jump directly to the blocked rule.
- Once the workspace supports editable segment blocks, approvals, and auto-balance, expand the Playwright coverage to include every guardrail from QA-RULE-017 through QA-RULE-030 before publishing a week.
- Keep this guide synchronized with `docs/onboarding-guide.md`, `docs/testing-approach.md`, and the agent artifacts (`artifacts/*`) to guarantee documentation, automation, and user training stay aligned.
