# Data Model Validation Constraints

## Ratio and Coverage
1. A `SegmentBlock` must aggregate `EnrollmentGroup.child_count` and compare against its `RatioProfile.children_per_staff`. Staff assignments count must meet `max(SegmentRequirementTemplate.min_staff, ceil(child_count / ratio.children_per_staff))` before the week leaves `draft`, and the violation references `PolicyCitation` from the ratio profile.
2. When a `FieldTripEvent` attaches to a block, its `FieldTripType` (`min_adult_student_ratio`, `min_leader_student_ratio`) replaces the base ratio; missing director `signed_off_at`/`approver_id` blocks submission.

## Qualifications and Certifications
3. `SegmentRequirementTemplate` flags (`requires_cpr`, `requires_medical_delegation`, `requires_leader`) translate into validations on the aggregated `StaffAssignment` pool: at least one active `Employee` must have corresponding `Certification`s that are `is_current`, and each derived flag references its `PolicyCitation` for traceability.
4. `Certification.expires_at` must be in the future for any assignment that relies on that credential; the system warns the scheduler before saving if the expiration is within the “expiring soon” window defined in policy.

## Shift and Break Limits
5. `StaffAssignment` duration is validated against `Employee.max_hours_per_day`; the sum of durations within the same `ScheduleWeek` cannot exceed `max_hours_per_week`. Every `ShiftBreak` carries a `policy_citation_id` and is rejected if it would drop coverage below the `SegmentBlock.required_staff` floor.

## Substitute Parity
6. When `is_substitute = true`, a linked `SubstituteRequest` must be `state = approved` with `approver_id`, `reason`, and `policy_citation_id`. The replacement `Employee` must pass all ratio/certification constraints that the original assignment required.

## Audit and Traceability
7. Every mutation to `ScheduleWeek`, `SegmentBlock`, `StaffAssignment`, or `SubstituteRequest` creates an `AuditEvent` that stores the `policy_citation_id` used during validation and links to the `ChangeJournalEntry` intent when the system is offline.
8. Immutable `ScheduleSnapshot`s persist at submission/approval so auditors can replay an approved week with the exact `StaffAssignment`/`ShiftBreak` configuration.
9. `ChangeJournalEntry.status` tracks pending/synced/failed intents; `ScheduleWeek` state transitions (`draft` → `ready_for_review` → `submitted` → `approved`) only happen after the rules engine confirms there are no outstanding violations tied to `PolicyCitation`s.
