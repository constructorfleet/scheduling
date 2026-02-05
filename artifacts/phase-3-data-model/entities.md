# Data Model: Entities

## Purpose
Capture every scheduling, compliance, and audit artifact so downstream agents have typed, referenceable inputs. Each entity explicitly links back to policy citations, derives the coverage math that feeds ratio enforcement, and retains timestamps for audit/event replay.

## Enumerations we rely on
- `JobTitle`, `DayScheduleType`, `ScheduleType`, `DaySegment`, `DayOfWeek`, `TripDay`, `AssignmentSource`, `ApprovalState`, `CPRCertification`, `MedDelegated`, `AuditAction`, `ScheduleStatus`, `ShiftStatus`, `BreakType`, `CertificationType`, `EmploymentStatus`, `JournalEntryStatus`, `EnrollmentSource`, `ValidationSeverity`, `ValidationStatus`.

## Master & Configuration Entities

### PolicyCitation
- `id`, `name`, `document`, optional `section`, optional `url`, `notes`.
- Ties every ratio, coverage, certification, substitute, break, and field-trip violation back to the district policy it enforces so auditors can trace the governance for each validation.

### SchoolProfile
- `id`, `name`, `district_id`, `timezone`, `primary_contact` (references an `Employee` or director), `notes`, `operating_hours` (list of `OperatingHours`).
- Owns `DayScheduleTemplate`s, `ScheduleWeek`s, `Employee`s, `RatioProfile`s, and `PolicyCitation`s.
- Enables the settings panel so schedulers can add/remove staff, update contact info, and keep school-specific policy references aligned with the DMV.

### OperatingHours
- `school_id`, `day_of_week`, `day_schedule_type` (`DayScheduleType`), `open`, `close`.
- Drives the allowable clock-in/out windows for the day and seeds `SegmentRequirementTemplate`s.

### RatioProfile
- `id`, `segment` (`DaySegment`), `children_per_staff`, `leader_required`, `policy_citation_id`, `notes`.
- Derived: `min_staff_from_ratio = ceil(child_count / children_per_staff)`.
- Applies to `SegmentRequirementTemplate`s and `SegmentBlock`s unless a `FieldTripEvent` overrides it.

### FieldTripType
- `id`, `name`, `min_adult_student_ratio`, `min_leader_student_ratio`, `policy_citation_id`, `notes`.
- Configured via the field-trip settings panel; every day must reference a valid type or declare `is_no_field_trip`.
- Drives the alternate coverage floor whenever a `FieldTripEvent` attaches to a `SegmentBlock`.

### DayScheduleTemplate & SegmentRequirementTemplate
- Template captures `school_id`, `type`, `segment_requirements`, and audit metadata (`created_by`, `created_at`).
- Segment requirements list the `ratio_profile_id`, minimum staff (`min_staff`), and boolean guards for CPR, medical delegation, and leader coverage, plus a `policy_citation_id`.
- Templates seed `SegmentBlock`s so the scheduler always starts with compliant expectations.

## Scheduling Entities

### ScheduleWeek
- `id`, `school_id`, `template_id`, `start_date` (Monday), `status`, `created_by`, `created_at`, `submitted_by`, `submitted_at`, `approved_by`, `approved_at`, `notes`.
- Drives snapshots/audit events as the week transitions from `draft` → `ready_for_review` → `submitted` → `approved`.
- Controls whether edits can mutate the persisted ledger or just record a `ChangeJournalEntry` until rules clear.

### ScheduleDay
- `id`, `schedule_week_id`, `date`, `day_of_week`, `schedule_type` (`ScheduleType`), `enrollment_count`, `enrollment_source` (`EnrollmentSource`), `field_trip_event_id`, `operating_capacity_override`, `notes`.
- Every day exposes a schedule-type dropdown (regular, extended, enrichment) plus an editable enrollment headcount and the field-trip selection (`FieldTripEvent` or explicit “No Field Trip”). Missing metadata triggers validation violations before a week can be saved.
- The schedule-type selection deterministically drives which `RatioProfile`s and certification guards the rules engine applies per time segment.

### SegmentBlock
- `id`, `schedule_week_id`, `schedule_day_id`, `day_of_week`, `segment`, `start_time`, `end_time`, `child_count`, `requirement_template_id`, `status`, `field_trip_event_id`, `operating_capacity_override`, `closed_reason`, `last_updated_by`, `last_updated_at`.
- Each `ScheduleDay` can host multiple non-contiguous clock-in/out `SegmentBlock`s so staff can sign in/out freely within operating hours, and coverage calculations re-run whenever blocks change.
- Derived fields:
  - `required_staff = max(requirement.min_staff, ceil(child_count / ratio.children_per_staff))` (ratio overrides when a field trip applies)
  - `coverage_gap = required_staff - staff_assignments.length`
  - `shortage` flag and `leader_guardrails` when `requirement` or `FieldTripEvent` signals a leader is needed.

### EnrollmentGroup
- `id`, `segment_block_id`, `child_count`, `source` (`roster`, `manual_adjustment`, `override`), `updated_at`, `notes`.
- Provides the child counts that feed `SegmentBlock` ratios and shortage warnings so edits immediately revalidate the current attendance.

### StaffAssignment
- `id`, `segment_block_id`, `employee_id`, `assignment_source`, `is_substitute`, `substitute_request_id`, `start_time`, `end_time`, `status`, `role`, `created_by`, `created_at`, `notes`.
- Opposite view used to compute shift lengths, guard against daily/weekly max hours, and qualify coverage.
- When `is_substitute` = true, references an approved `SubstituteRequest`; the replacement `Employee` must satisfy the same ratio/certification requirements tied to the original block.

### ShiftBreak
- `id`, `assignment_id`, `start_time`, `end_time`, `break_type`, `approved_by`, `approved_at`, `policy_citation_id`, `notes`.
- Captures required rest/meal coverage. The rules engine blocks any break that would drop coverage below the `SegmentBlock.required_staff` floor or conflict with overlapping clock blocks.

### SubstituteRequest
- `id`, `original_assignment_id`, `segment_block_id`, `replacement_employee_id`, `requested_by`, `requested_at`, `state`, `reason`, `approver_id`, `approved_at`, `policy_citation_id`, `notes`.
- Stores metadata visible to the rules engine for parity checks and to the audit trail for compliance reporting.

### FieldTripEvent
- `id`, `schedule_week_id`, `schedule_day_id`, `day_of_week`, `field_trip_type_id`, `is_no_field_trip`, `approver_id`, `signed_off_at`, `policy_citation_id`, `notes`.
- Every `ScheduleDay` links to a single field-trip decision. The `is_no_field_trip` flag lets teams explicitly opt out while keeping validations tied to that declared state.
- Supplies alternate ratios (`FieldTripType`) and leader/adult requirements; the event blocks `SegmentBlock`s from progressing until director sign-off metadata exists.

### Employee
- `id`, `name`, `contact_info`, `job_title`, `home_school_id`, `max_hours_per_day`, `max_hours_per_week`, `employment_status`, `notes`.
- Derived booleans: `leader_qualified`, `medically_delegated`, `cpr_current` (from certifications). Rules check these before allowing assignments or substitutes.

### Certification
- `id`, `employee_id`, `type`, `issued_at`, `expires_at`, `document_reference`, `policy_citation_id`, `notes`.
- Derived: `is_current = expires_at > now`; scheduling surfaces warnings when assignments depend on soon-to-expire credentials.

### AvailabilityWindow
- `id`, `employee_id`, `day_of_week`, `segment`, `start_time`, `end_time`, `notes`.
- Helps the optimizer match staff to shortage windows without violating daily/weekly limits.

## Compliance & Audit Entities

### ValidationViolation
- `id`, `schedule_week_id`, `target_type`, `target_id`, `rule_id`, `policy_citation_id`, `message`, `severity` (`ValidationSeverity`), `status` (`ValidationStatus`), `created_at`, `cleared_at`, `notes`.
- Represents the rules engine output tied to specific metadata changes (schedule type, enrollment, field-trip selection, assignments). Violations stay `active` until the underlying data passes the rule; there is no manual “mark addressed.”

### AuditEvent
- `id`, `target_type`, `target_id`, `actor_id`, `timestamp`, `action`, `changes`, `policy_citation_id`, `notes`.
- Immutable log for compliance reviews. Every mutating action (assignment, field-trip edit, enrollment change) writes an `AuditEvent`.

### ScheduleSnapshot
- `id`, `schedule_week_id`, `captured_at`, `captured_by`, `payload`, `reason`.
- Stored when a schedule is submitted, approved, or archived so auditors can replay the exact configuration.

### ChangeJournalEntry
- `id`, `schedule_week_id`, `actor_id`, `timestamp`, `action`, `target_type`, `target_id`, `payload`, `policy_citation_id`, `notes`, `status` (`JournalEntryStatus`), `synced_at`.
- Captures every offline/intended mutation so persistence can trace pending intents and audit-ready exports.

## Data Lifecycle Notes
1. `SchoolProfile` gathers ratios, certifications, and policy citations; `DayScheduleTemplate`s plus per-day `ScheduleDay` configuration capture schedule-type selections, enrollment headcounts, and field-trip metadata for each week.
2. Creating or cloning a `ScheduleWeek` instantiates `ScheduleDay`s for each calendar day with editable enrollment counts, the chosen `ScheduleType`, and a linked `FieldTripEvent`. Each day hosts multiple `SegmentBlock`s, so clock-in/out windows flow into derived coverage math.
3. Scheduling actions (assignments, substitutes, field-trip edits, enrollment updates, schedule-type changes) create `ChangeJournalEntry`s, trigger the rules engine, and write `ValidationViolation`s tied to the affected `ScheduleDay`, `SegmentBlock`, or `StaffAssignment`.
4. Violations cite `PolicyCitation`s and remain `active` until the data satisfies the rule; editing the underlying entity re-runs validation and clears the violation automatically once compliant.
5. Field-trip lifecycle edits (deleting a `FieldTripType` or changing ratios) force every linked `ScheduleDay` to point to another type or explicitly declare `No Field Trip` before the week can be saved.
