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

## Automation & operational checklist
1. **Jest suites**: `npm test -- tests/ui/DayMetadataStrip.test.tsx tests/ui/ClockBlockTimeline.test.tsx` verifies every metadata handler and the timeline focus/violation hooks. Install `jest-environment-jsdom` (or add it to devDependencies) before running—without it, Jest cannot mount the DOM. The registry is currently unreachable (`getaddrinfo ENOTFOUND`), so restore network access before rerunning.
2. **Playwright e2e**: `tests/e2e/day-metadata-workflows.spec.ts`, `guided-workflows.spec.ts`, `workspace-interactions.spec.ts`, and `violation-workflows.spec.ts` track the guided flow, field-trip re-blocking, and live violation navigator. These specs stall right now because the Vite dev server cannot bind to `127.0.0.1:4174` (`listen EPERM`). Fix the binding (or point `playwright.config.ts` to an allowed host/port) before rerunning `npm run test:e2e`.
3. **CI readiness**: Run `npm run build:static` with `SKIP_TYPE_CHECK=0` once the outstanding TypeScript/test issues are resolved so the generated `build-metadata.json` captures the full clean → type-check → build sequence. Use this metadata in release verifications (`artifacts/phase-9-deployment/deployment-guide.md`).

## Troubleshooting & next steps
- If violations persist after edits, confirm that the rules engine sees the updated clock-in/out times (all times are part of the block object) and the right ratio profile. Clock-time mismatches are the most common reason validations stay active.
- The guided tracker uses icons (clock, badge, shield) to explain why steps are blocked—include those details in any support ticket so engineers can jump directly to the blocked rule.
- Once the workspace supports editable segment blocks, approvals, and auto-balance, expand the Playwright coverage to include every guardrail from QA-RULE-017 through QA-RULE-030 before publishing a week.
- Keep this guide synchronized with `docs/onboarding-guide.md`, `docs/testing-approach.md`, and the agent artifacts (`artifacts/*`) to guarantee documentation, automation, and user training stay aligned.
