# Rules Engine Detailed Test Cases

These cases cover every planned rules engine rule so the rules engine fulfills the QA agent definition of done (critical compliance paths). Once rules are implemented under `src/rules/`, link each case back to the policy catalog and the test fixtures that exercise the scenario.

## Rule: ratio-segment (Staff-student/time-segment ratios)
- **Source:** `artifacts/phase-1-discovery/rules-catalog.md:4` (segment-level ratio ceilings)

### QA-RULE-001 – Understaffed segment (violation)
- **Preconditions:** single `SegmentBlock` with `childCount = 18`, ratio `childrenPerStaff = 8`, one assignment, min staff default 0.
- **Execution:** feed the constructed context into `RulesEngine.evaluate()` and inspect violations.
- **Expectation:** `ratio-segment` violation referencing `policy-default`, context includes day/segment, and message quotes `ceil(children / ratio)`.
- **Verification:** TBD.

### QA-RULE-002 – Compliant ratio/minded minima (clean)
- **Preconditions:** block with `childCount = 16`, `requirementMinStaff = 2`, two distinct assignments, ratio unchanged.
- **Expectation:** no `ratio-segment` violations when assignments meet both the ratio and explicit minimum.
- **Verification:** TBD.

## Rule: certification-per-segment (CPR/medical/leader coverage)
- **Source:** `artifacts/phase-1-discovery/rules-catalog.md:16`

### QA-RULE-005 – Missing certification flags (violation)
- **Preconditions:** segment requires CPR, medical delegation, leader; assigned employee lacks all flags.
- **Expectation:** three `certification-per-segment` entries (one per requirement) that call out the missing role and cite specific policy.
- **Verification:** TBD.

### QA-RULE-006 – Fully qualified assignment (clean)
- **Preconditions:** assigned employee meets CPR, medical delegation, and leader flags.
- **Expectation:** no `certification-per-segment` violations.
- **Verification:** TBD.

## Rule: shift-break-limits (Shift and weekly caps)
- **Source:** `artifacts/phase-1-discovery/rules-catalog.md:22`

### QA-RULE-007 – Shift/weekly cap exceeded (violation)
- **Preconditions:** assignments span beyond `maxHoursPerDay` and aggregate more than `maxHoursPerWeek` for the same employee.
- **Expectation:** at least one `shift-break-limits` violation per threshold breach with assignment context and policy citation.
- **Verification:** TBD (add to rules engine tests).

### QA-RULE-008 – Shifts stay within caps (clean)
- **Preconditions:** two 4-hour assignments, `maxHoursPerDay = 8`, `maxHoursPerWeek = 16`.
- **Expectation:** no `shift-break-limits` violations.
- **Verification:** TBD.

## Rule: segment-coverage (Leader + medically delegated coverage)
- **Source:** `artifacts/phase-1-discovery/rules-catalog.md:28`

### QA-RULE-009 – Segment missing roles (violation)
- **Preconditions:** `SegmentBlock.segment = "open"`, assigned employee lacks leader and medically delegated flags.
- **Expectation:** two `segment-coverage` violations (missing leader + missing medically delegated staff).
- **Verification:** TBD (add to rules engine tests).

### QA-RULE-010 – Coverage requirements satisfied (clean)
- **Preconditions:** `SegmentBlock.segment = "close"`, assigned employee holds both leader and medically delegated qualifications.
- **Expectation:** rule does not emit violations for this block.
- **Verification:** TBD.

## Rule: substitute-parity (Substitute approvals)
- **Source:** `artifacts/phase-1-discovery/rules-catalog.md:34`

### QA-RULE-011 – Missing substitute request metadata (violation)
- **Preconditions:** substitute assignment references a non-existent request.
- **Expectation:** `substitute-parity` violation tied to the substitute assignment id and block context.
- **Verification:** TBD (add to rules engine tests).

### QA-RULE-012 – Approved substitute with metadata (clean)
- **Preconditions:** substitute request exists in `state = "approved"` with approver, timestamp, reason, and policy citation.
- **Expectation:** no violations.
- **Verification:** TBD.

## Rule: field-trip-ratios (Field trip adult/leader ratios)
- **Source:** `artifacts/phase-1-discovery/rules-catalog.md:40`

### QA-RULE-013 – Trip under-provisioned (violation)
- **Preconditions:** field trip block with 20 children and a single assignment (adults/leaders under minima).
- **Expectation:** at least one `field-trip-ratios` violation that includes the trip type and day/segment details.
- **Verification:** TBD (add to rules engine tests).

### QA-RULE-014 – Adult and leader minima met (clean)
- **Preconditions:** trip block staffed by five employees, including two leader-qualified attendees, satisfying ratios derived from `FieldTripType`.
- **Expectation:** rule emits no violations.
- **Verification:** TBD.

## Rule: field-trip-signoff (Director approvals)
- **Source:** `artifacts/phase-1-discovery/edge-cases.md:16` (director sign-off requirement)

### QA-RULE-015 – Missing approver/timestamp (violation)
- **Preconditions:** `FieldTripEvent` lacks `approverId` and `signedOffAt` but is linked to a block.
- **Expectation:** `field-trip-signoff` violation whose `metadata.missing` array lists both missing values.
- **Verification:** TBD.

### QA-RULE-016 – Signed-off trip (clean)
- **Preconditions:** event already has `approverId` and `signedOffAt` set.
- **Expectation:** no sign-off violations reported.
- **Verification:** TBD (add to rules engine tests).
