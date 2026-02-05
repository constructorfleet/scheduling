# Data Model Relationships

## Template and Master Data
- `SchoolProfile` 1→* `DayScheduleTemplate`, `ScheduleWeek`, `Employee`, `RatioProfile`, `PolicyCitation`.
- `DayScheduleTemplate` owns `SegmentRequirementTemplate`s; each template points to a `RatioProfile` so the correct coverage math travels with each clone.

## Weekly Scheduling Graph
- `ScheduleWeek` 1→* `SegmentBlock`, `FieldTripEvent`, `ScheduleSnapshot`, `AuditEvent`, `ChangeJournalEntry`.
- `SegmentBlock` 1→* `EnrollmentGroup`, `StaffAssignment`; it references a `SegmentRequirementTemplate`, optional `FieldTripEvent`, and enforces `required_staff` derived from either `RatioProfile` or `FieldTripType`.
- `EnrollmentGroup` ↔ `SegmentBlock` (1→*). Child counts aggregate to feed `SegmentBlock.coverage_gap` indicators.
- `StaffAssignment` connects to `SegmentBlock`, `Employee`, and optional `SubstituteRequest`; `ShiftBreak`s 1→* `StaffAssignment` and each break references a `PolicyCitation` for the covered regulation.

## People, Qualifications, and Substitutes
- `Employee` 1→* `Certification`, `AvailabilityWindow`, `StaffAssignment`, `AuditEvent`.
- `Certification` references `PolicyCitation` and expires, feeding the derived flags `cpr_current`, `medically_delegated`, and `leader_qualified`.
- `SubstituteRequest` slots between the original `StaffAssignment` and the replacement `Employee`; approval metadata enables the rules engine to assert parity before writing a substitute assignment.

## Compliance and Audit Graph
- `FieldTripEvent` → `FieldTripType` plus `SegmentBlock` overrides; it requires `approver_id` and `signed_off_at` to transition the week past `ready_for_review`.
- `AuditEvent` and `ScheduleSnapshot` both tie back to `ScheduleWeek` so exports replay every transition with policy citations attached.
- `ChangeJournalEntry` links online/offline intents with final `AuditEvent`s and `ScheduleSnapshot`s, maintaining `status` indexes for reconciliation (pending→synced/failed).
