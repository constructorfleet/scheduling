# Rules Engine Detailed Test Cases

These cases cover every planned rules engine rule so the rules engine fulfills the QA agent definition of done (critical compliance paths). Once rules are implemented under `src/rules/`, link each case back to the policy catalog and the test fixtures that exercise the scenario.

## Rule: ratio-segment (Staff-student/time-segment ratios)
- **Source:** `artifacts/phase-1-discovery/rules-catalog.md:4` (segment-level ratio ceilings)

### QA-RULE-001 – Understaffed segment (violation)
- **Preconditions:** single `SegmentBlock` with `childCount = 18`, ratio `childrenPerStaff = 8`, one assignment, min staff default 0.
- **Execution:** feed the constructed context into `RulesEngine.evaluate()` and inspect violations.
- **Expectation:** `ratio-segment` violation referencing `policy-default`, context includes day/segment, and message quotes `ceil(children / ratio)`.
- **Verification:** `tests/rules/rulesEngine.test.ts:83` (covers the under-staffed `block-ratio` scenario).

### QA-RULE-002 – Compliant ratio/minded minima (clean)
- **Preconditions:** block with `childCount = 16`, `requirementMinStaff = 2`, two distinct assignments, ratio unchanged.
- **Expectation:** no `ratio-segment` violations when assignments meet both the ratio and explicit minimum.
- **Verification:** `tests/rules/rulesEngine.test.ts:105` (ensures `block-ratio-clean` meets both ratio and minimums).

### QA-RULE-017 – Field-trip overrides skip segment ratios
- **Preconditions:** a `SegmentBlock` linked to a signed-off `FieldTripEvent` with insufficient assignments (e.g., one employee covering 20 children).
- **Execution:** run `RulesEngine.evaluate()` and collect `ratio-segment` and `field-trip-ratios` violations.
- **Expectation:** `ratio-segment` should ignore the block while `field-trip-ratios` reports the under-provisioned adults/leaders.
- **Verification:** `tests/rules/rulesEngine.test.ts` (new `block-trip-ratio-skip` fixture ensures the dedicated field-trip ratio rule fires and the segment ratio rule remains quiet).

## Rule: certification-per-segment (CPR/medical/leader coverage)
- **Source:** `artifacts/phase-1-discovery/rules-catalog.md:16`

### QA-RULE-005 – Missing certification flags (violation)
- **Preconditions:** segment requires CPR, medical delegation, leader; assigned employee lacks all flags.
- **Expectation:** three `certification-per-segment` entries (one per requirement) that call out the missing role and cite specific policy.
- **Verification:** `tests/rules/rulesEngine.test.ts:132` (`block-cert` triggers missing CPR, medical delegation, and leader violations).

### QA-RULE-006 – Fully qualified assignment (clean)
- **Preconditions:** assigned employee meets CPR, medical delegation, and leader flags.
- **Expectation:** no `certification-per-segment` violations.
- **Verification:** `tests/rules/rulesEngine.test.ts:158` (`block-cert-clean` proves the clean path).

## Rule: shift-break-limits (Shift and weekly caps)
- **Source:** `artifacts/phase-1-discovery/rules-catalog.md:22`

### QA-RULE-007 – Shift/weekly cap exceeded (violation)
- **Preconditions:** assignments span beyond `maxHoursPerDay` and aggregate more than `maxHoursPerWeek` for the same employee.
- **Expectation:** at least one `shift-break-limits` violation per threshold breach with assignment context and policy citation.
- **Verification:** `tests/rules/rulesEngine.test.ts:238` (two back-to-back assignments breach daily and weekly caps for `emp-shift`).

### QA-RULE-008 – Shifts stay within caps (clean)
- **Preconditions:** two 4-hour assignments, `maxHoursPerDay = 8`, `maxHoursPerWeek = 16`.
- **Expectation:** no `shift-break-limits` violations.
- **Verification:** `tests/rules/rulesEngine.test.ts:265` (`emp-shift-clean` tracks two 4-hour blocks with no breaches).

### QA-RULE-018 – Weekly limits require cross-day enforcement
- **Preconditions:** an employee works safe hours per day (e.g., two 6-hour shifts on Monday and Tuesday) but the aggregated weekly total exceeds `maxHoursPerWeek`.
- **Execution:** evaluate the two-day context and inspect `shift-break-limits` violations.
- **Expectation:** a single weekly violation is emitted while daily limits remain clean.
- **Verification:** `tests/rules/rulesEngine.test.ts` (`block-weekly-...` fixture validates the weekly violation message and absence of daily flags).

## Rule: segment-coverage (Leader + medically delegated coverage)
- **Source:** `artifacts/phase-1-discovery/rules-catalog.md:28`

### QA-RULE-009 – Segment missing roles (violation)
- **Preconditions:** `SegmentBlock.segment = "open"`, assigned employee lacks leader and medically delegated flags.
- **Expectation:** two `segment-coverage` violations (missing leader + missing medically delegated staff).
- **Verification:** `tests/rules/rulesEngine.test.ts:187` (`block-coverage` raises both coverage violations).

### QA-RULE-010 – Coverage requirements satisfied (clean)
- **Preconditions:** `SegmentBlock.segment = "close"`, assigned employee holds both leader and medically delegated qualifications.
- **Expectation:** rule does not emit violations for this block.
- **Verification:** `tests/rules/rulesEngine.test.ts:211` (`block-coverage-clean` proves the clean path).

## Rule: substitute-parity (Substitute approvals)
- **Source:** `artifacts/phase-1-discovery/rules-catalog.md:34`

### QA-RULE-011 – Missing substitute request metadata (violation)
- **Preconditions:** substitute assignment references a non-existent request.
- **Expectation:** `substitute-parity` violation tied to the substitute assignment id and block context.
- **Verification:** `tests/rules/rulesEngine.test.ts:290` (`assign-sub` lacks a request and fails parity checks).

### QA-RULE-012 – Approved substitute with metadata (clean)
- **Preconditions:** substitute request exists in `state = "approved"` with approver, timestamp, reason, and policy citation.
- **Expectation:** no violations.
- **Verification:** `tests/rules/rulesEngine.test.ts:311` (`assign-sub-clean` uses an approved request with full metadata).

### QA-RULE-019 – Substitute parity flags incomplete approvals
- **Preconditions:** a substitute assignment references a request that exists but is still `pending` or missing approver/timestamp metadata.
- **Execution:** feed the context into `RulesEngine.evaluate()` and capture the `missing` array from the `substitute-parity` violation.
- **Expectation:** the violation lists every missing property (`state`, `approverId`, `approvedAt`, etc.) without allowing the assignment to persist.
- **Verification:** `tests/rules/rulesEngine.test.ts` (`block-sub-incomplete` fixture asserts the `missing` metadata and single violation).

## Rule: field-trip-ratios (Field trip adult/leader ratios)
- **Source:** `artifacts/phase-1-discovery/rules-catalog.md:40`

### QA-RULE-013 – Trip under-provisioned (violation)
- **Preconditions:** field trip block with 20 children and a single assignment (adults/leaders under minima).
- **Expectation:** at least one `field-trip-ratios` violation that includes the trip type and day/segment details.
- **Verification:** `tests/rules/rulesEngine.test.ts:344` (`block-trip` is short on adults/leaders despite signed-off event metadata).

### QA-RULE-014 – Adult and leader minima met (clean)
- **Preconditions:** trip block staffed by five employees, including two leader-qualified attendees, satisfying ratios derived from `FieldTripType`.
- **Expectation:** rule emits no violations.
- **Verification:** `tests/rules/rulesEngine.test.ts:384` (`block-trip-clean` adds four employees, two leaders, and clears the ratio rule).

### QA-RULE-020 – Leader shortages surface even when adult coverage is adequate
- **Preconditions:** a field-trip block has enough unique adults to satisfy the adult ratio but lacks the minimum number of leader-qualified attendees (e.g., four adults, only one leader).
- **Execution:** evaluate and isolate `field-trip-ratios` violations.
- **Expectation:** only the leader shortage violation appears, confirming the rule evaluates leaders separately from adults.
- **Verification:** `tests/rules/rulesEngine.test.ts` (`block-trip-leader-shortage` fixture asserts a single violation mentioning `leaders`).

## Rule: field-trip-signoff (Director approvals)
- **Source:** `artifacts/phase-1-discovery/edge-cases.md:16` (director sign-off requirement)

### QA-RULE-015 – Missing approver/timestamp (violation)
- **Preconditions:** `FieldTripEvent` lacks `approverId` and `signedOffAt` but is linked to a block.
- **Expectation:** `field-trip-signoff` violation whose `metadata.missing` array lists both missing values.
- **Verification:** `tests/rules/rulesEngine.test.ts:429` (`ft-event-2` without approval metadata trigs sign-off violation).

### QA-RULE-016 – Signed-off trip (clean)
- **Preconditions:** event already has `approverId` and `signedOffAt` set.
- **Expectation:** no sign-off violations reported.
- **Verification:** `tests/rules/rulesEngine.test.ts:452` (`ft-event-4` includes both fields and clears the rule).

### QA-RULE-021 – Sign-off violations can list only the missing approver
- **Preconditions:** `FieldTripEvent` has `signedOffAt` but lacks an `approverId`.
- **Execution:** evaluate the event and inspect the `missing` payload on the `field-trip-signoff` violation.
- **Expectation:** the rule emits a violation containing only `["approverId"]` so users know exactly what field is absent.
- **Verification:** `tests/rules/rulesEngine.test.ts` (`ft-event-6` fixture confirms the selective metadata and violation).
