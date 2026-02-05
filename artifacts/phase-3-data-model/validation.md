# Data Model Validation Constraints

## Schedule Day Metadata & Field Trip Lifecycle
1. Every `ScheduleDay` must store a `ScheduleType`, enrollment headcount, and a linked `FieldTripEvent` (or explicit `is_no_field_trip` flag). Missing metadata prevents the week from saving and surfaces a `ValidationViolation` tied to that day so schedulers cannot leave the dropdowns blank.
2. Editing `ScheduleDay.enrollment_count` (even to zero) re-triggers ratio calculations for all related `SegmentBlock`s so the rules engine can immediately flag shortages or confirm the current headcount still satisfies the selected schedule type and field-trip profile.
3. Deleting or modifying a `FieldTripType` forces every linked `ScheduleDay` to pick a valid replacement or declare `No Field Trip` before the week can be saved, and the rules engine revalidates each affected week until the updated ratios are satisfied.

## Coverage, Ratios, and Clock Blocks
4. `SegmentBlock.required_staff` derives from `SegmentRequirementTemplate.min_staff`, the aggregated `EnrollmentGroup.child_count`, and the applicable `RatioProfile` (or `FieldTripType` override). Staff assignments across the block must meet this derived value, and `coverage_gap` calculates `required_staff - staff_assignments.length` so the shortage view always reflects real-time coverage.
5. Field trips override the base ratios. When a `FieldTripEvent` applies, `min_adult_student_ratio` and `min_leader_student_ratio` from the selected `FieldTripType` become the source of truth—regardless of a zero enrollment—ensuring adult/leader requirements remain enforced while director `signed_off_at` and `approver_id` guard the override.
6. Multiple non-contiguous `SegmentBlock`s per day share the same `ScheduleDay` metadata; overlapping blocks or uncovered windows trigger violations that reference the specific block, and clearing them requires editing the affected blocks (changing start/end or adding staff) rather than marking them addressed manually.
7. `StaffAssignment`s must satisfy the certificate requirements (`requires_cpr`, `requires_medical_delegation`, `requires_leader`) defined in the connected `SegmentRequirementTemplate`. Derived `Employee` booleans (`cpr_current`, `medically_delegated`, `leader_qualified`) drive the validation, which references the appropriate `PolicyCitation` for each guardrail.
8. `StaffAssignment` durations must respect `Employee.max_hours_per_day`, and aggregated durations for the week must stay ≤ `max_hours_per_week`; associated `ShiftBreak`s require policy references and cannot drop coverage below the block’s `required_staff`.

## Substitutes, Certifications, and Approvals
9. When `is_substitute = true`, a linked `SubstituteRequest` must exist in `state = approved` with `approver_id`, `reason`, and `policy_citation_id`. The replacement employee must pass every ratio/certification validation that applied to the original assignment, so substitutes cannot bypass guardrails.
10. `Certification.expires_at` must always be future-dated before an assignment references that credential. The rules engine warns schedulers if a certification is within the “expiring soon” window defined in policy, and it blocks saves when a credential would lapse mid-assignment.

## Validation Lifecycle & Audit Trail
11. Every mutation writes a `ValidationViolation` that cites a `PolicyCitation`. Violations remain `active` until the underlying `ScheduleDay`, `SegmentBlock`, `StaffAssignment`, or `FieldTripEvent` data satisfies the rule; there is no “mark addressed,” so edits automatically re-run validation and clear records once the data passes.
12. Each change to `ScheduleWeek`, `ScheduleDay`, `SegmentBlock`, `StaffAssignment`, `SubstituteRequest`, or `FieldTripEvent` generates an `AuditEvent` (with the relevant `policy_citation_id`) and may trigger a `ScheduleSnapshot` so auditors can replay the exact configuration at submission/approval.
13. `ChangeJournalEntry.status` (pending/synced/failed) tracks offline intents; the week cannot transition out of `draft` or `ready_for_review` while violations remain `active` or while required journal entries are still pending reconciliation.
