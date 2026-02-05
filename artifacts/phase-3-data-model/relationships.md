# Data Model Relationships

## Template and Master Data
- `SchoolProfile` 1→* `DayScheduleTemplate`, `ScheduleWeek`, `Employee`, `RatioProfile`, `PolicyCitation`.
- `OperatingHours` instances tie back to `SchoolProfile` so every day knows its permitted clock-in/out window.
- `DayScheduleTemplate` owns `SegmentRequirementTemplate`s; each template points to a `RatioProfile` so the correct coverage math travels with each clone.
- `FieldTripType`s are referenced by `FieldTripEvent`s and carry the director-approved ratio metadata that can be updated or deleted via the configuration panel.

## Weekly Scheduling Graph
- `ScheduleWeek` 1→* `ScheduleDay`, `SegmentBlock`, `FieldTripEvent`, `ScheduleSnapshot`, `AuditEvent`, `ChangeJournalEntry`.
- `ScheduleDay` 1→* `SegmentBlock`, 1→1 `FieldTripEvent`, 1→* `ValidationViolation`. It stores the selected `ScheduleType`, enrollment headcount, and field-trip decision so rules know which ratios to apply.
- `SegmentBlock` 1→* `EnrollmentGroup`, `StaffAssignment`; it references a `SegmentRequirementTemplate`, optionally a `FieldTripEvent`, and enforces `required_staff` derived from either the base `RatioProfile` or the `FieldTripType`.
- `EnrollmentGroup` ↔ `SegmentBlock` (1→*). Child counts aggregate to feed `SegmentBlock.coverage_gap` indicators across multiple non-contiguous clock blocks.
- `StaffAssignment` connects to `SegmentBlock`, `Employee`, and optional `SubstituteRequest`; `ShiftBreak`s 1→* `StaffAssignment`, and each break references a `PolicyCitation` for the covered regulation.
- `ValidationViolation` references `ScheduleDay`, `SegmentBlock`, `StaffAssignment`, or `FieldTripEvent` so reviewers can inspect the entity that keeps a violation `active`.

## People, Qualifications, and Substitutes
- `Employee` 1→* `Certification`, `AvailabilityWindow`, `StaffAssignment`, `AuditEvent`.
- `Certification` references `PolicyCitation` and expires, feeding the derived flags `cpr_current`, `medically_delegated`, and `leader_qualified`.
- `SubstituteRequest` slots between the original `StaffAssignment` and the replacement `Employee`; approval metadata enables the rules engine to assert parity before writing a substitute assignment.

## Compliance and Audit Graph
- `FieldTripEvent` → `FieldTripType` plus `SegmentBlock` overrides; it requires `approver_id` and `signed_off_at` to transition the week past `ready_for_review`, and every deleted `FieldTripType` forces linked `ScheduleDay`s to reassign before save.
- `AuditEvent`, `ScheduleSnapshot`, and `ChangeJournalEntry` tie back to `ScheduleWeek` so exports replay every transition with policy citations attached while journaling offline edits.
- `ChangeJournalEntry` maintains its own indexes so pending intents (status = `pending`) surface before rules clear the violations that block transition to `ready_for_review`.
