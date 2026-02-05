# Rules Engine Test Plan

## Overview
Every rules engine obligation has at least one violation and one clean scenario captured through automated unit tests and documented cases. This plan enumerates the required contexts for each rule, highlights how the existing Jest suite covers them, and points back to the catalog of policy-anchored test cases in `RULES_TEST_CASES.md`.

## Rule Coverage Matrix

Each rule below lists the critical compliance-side scenario (what will produce a violation) and the happy-path scenario (no violations). The automated test references show where the assertions live in `tests/rules/rulesEngine.test.ts`; the supporting rationale is mirrored in `RULES_TEST_CASES.md`.

### ratio-segment
- **Critical scenario (violation):** A segment block with fewer staff assignments than `max(minStaff, ceil(childCount / ratio.childrenPerStaff))`, e.g., 18 children with only one assignee and no enforced minimum.
- **Happy-path (clean):** Assignment count meets both the ratio and any explicit minimum (e.g., three employees cover 24 children with `minStaff = 3`).
- **Automated reference:** `tests/rules/rulesEngine.test.ts` ratio tests that flag `ratio-segment` violations and verify a zero-violation outcome; see `RULES_TEST_CASES.md` entries QA-RULE-001/QA-RULE-002.
- **Field-trip overrides:** Blocks tied to signed-off field trips skip this rule so their adult/leader coverage is governed by `field-trip-ratios`; QA-RULE-017 proves that the segment ratio rule remains silent while the field-trip variant raises violations.

### certification-per-segment
- **Critical scenario:** A block requiring CPR, medical delegation, and leader flags with an assignment that lacks all three certifications (results in three separate violations).
- **Happy-path:** The assigned employee satisfies every required flag, so the rule emits no violations.
- **Automated reference:** Certification-focused tests in `tests/rules/rulesEngine.test.ts` plus QA-RULE-005/QA-RULE-006 in `RULES_TEST_CASES.md`.

### segment-coverage
- **Critical scenario:** A block that submits without leader-qualified or medically delegated staff despite template requirements, triggering two coverage violations.
- **Happy-path:** A leader-qualified, medically delegated assignment satisfies the coverage guardrails with zero violations.
- **Automated reference:** Coverage tests in `tests/rules/rulesEngine.test.ts` and QA-RULE-009/QA-RULE-010.

### shift-break-limits
- **Critical scenario:** Back-to-back assignments push an employee past `maxHoursPerDay` and `maxHoursPerWeek`, resulting in distinct daily and weekly violations.
- **Happy-path:** Assignments remain below both caps (e.g., two four-hour blocks vs. eight-hour daily and sixteen-hour weekly limits).
- **Automated reference:** Shift limit tests documented under QA-RULE-007/QA-RULE-008.
- **Weekly-total enforcement:** A weekly violation surfaces even when each day's hours are compliant, keeping cumulative totals and QA-RULE-018 in sync.

### substitute-parity
- **Critical scenario:** A substitute assignment references a missing or non-approved request, generating a violation that enumerates the absent metadata (`substituteRequest`, `state`, `approverId`, etc.).
- **Happy-path:** The substitute request is approved with approver/timestamp/reason metadata, satisfying parity.
- **Automated reference:** Substitute parity tests and QA-RULE-011/QA-RULE-012.
- **Approval metadata completeness:** Even a pending request with missing approver/timestamp fields triggers QA-RULE-019, which proves the violation lists each missing property before persistence.

### field-trip-ratios
- **Critical scenario:** A trip block with child/adult counts below the `FieldTripType`'s `minAdultStudentRatio` or `minLeaderStudentRatio`, yielding adult and/or leader violations.
- **Happy-path:** Enough unique adult assignments and leader-qualified employees meet both ratio minima.
- **Automated reference:** Field-trip ratio tests and QA-RULE-013/QA-RULE-014.
- **Leader-specific shortages:** QA-RULE-020 isolates the leader ratio so that adequate adult coverage alone does not suppress a leader shortage violation.

### field-trip-signoff
- **Critical scenario:** A `FieldTripEvent` without `approverId` and/or `signedOffAt` throws a sign-off violation that lists every missing field.
- **Happy-path:** Both fields are populated so the event clears the rule.
- **Automated reference:** Sign-off tests and QA-RULE-015/QA-RULE-016.
- **Partial metadata enforcement:** QA-RULE-021 demonstrates that missing only `approverId` still produces a `field-trip-signoff` violation, keeping approvals explicit.

## Validation Strategy

- **Unit coverage:** Each scenario above is exercised in `tests/rules/rulesEngine.test.ts` via mocked `RulesContext` fixtures.
- **Documentation alignment:** `RULES_TEST_CASES.md` narrates the policy motivation, expected violations, and specific test file references for auditors.
- **Next automation layers:** Surface these rules in integration/end-to-end flows (e.g., schedule workspace + conflict navigation) once the helper data stores exist so the UI surfaces violations prior to persistence.

## Next steps

1. Link this plan and the `RULES_TEST_CASES.md` catalog to the QA dashboard so stakeholders can trace violations back to policy citations.
2. Expand the plan once additional rules (such as break tracking or audit emissions) land in the engine.
