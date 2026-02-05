# Data Model: Entities

## Purpose
Capture every scheduling, compliance, and audit artifact so downstream agents have typed, referenceable inputs. Each entity explicitly links back to policy citations, derives the coverage math that feeds ratio enforcement, and retains timestamps for audit/event replay.

## Enumerations we rely on
- `JobTitle`, `DayScheduleType`, `DaySegment`, `DayOfWeek`, `TripDay`, `AssignmentSource`, `ApprovalState`, `CPRCertification`, `MedDelegated`, `AuditAction`, `ScheduleStatus`, `ShiftStatus`, `BreakType`, `CertificationType`, `EmploymentStatus`, `JournalEntryStatus`.

## Key Entities

### PolicyCitation
- `id`, `name`, `document`, optional `section`, `url`, `notes`.
- Ties every ratio, coverage, certification, substitute, break, and field-trip violation back to the district policy it enforces.

### RatioProfile
- `id`, `segment` (`DaySegment`), `children_per_staff`, `leader_required`, `policy_citation_id`, `notes`.
- Derived: `min_staff_from_ratio = ceil(child_count / children_per_staff)`.
- Applies to `SegmentRequirementTemplate`s and `SegmentBlock`s unless a `FieldTripEvent` overrides it.

### FieldTripType
- `id`, `name`, `min_adult_student_ratio`, `min_leader_student_ratio`, `policy_citation_id`, `notes`.
- Drives the alternate coverage floor when a `FieldTripEvent` is attached to a `SegmentBlock`.

### DayScheduleTemplate & SegmentRequirementTemplate
- Template captures `school_id`, `type`, `segment_requirements`, and audit metadata (`created_by`, `created_at`).
- Segment requirements list the `ratio_profile_id`, minimum staff (`min_staff`), and boolean guards for CPR, medical delegation, and leader coverage, plus a `policy_citation_id`.
- Templates seed `SegmentBlock`s so the scheduler always starts with compliant expectations.

### ScheduleWeek
- `id`, `school_id`, `template_id`, `start_date`, `status`, `created_by`, timestamps for submission/approval, `notes`.
- Drives snapshots/audit events as it moves from `draft` → `ready_for_review` → `approved`.

### SegmentBlock
- `id`, `schedule_week_id`, `day_of_week`, `segment`, `start_time`, `end_time`, `child_count`, `requirement_template_id`, `status`, optional `field_trip_event_id`, `operating_capacity_override`, `closed_reason`, `last_updated_by`, `last_updated_at`.
- Derived fields: `required_staff = max(min_staff, ceil(child_count / ratio.children_per_staff))`, `coverage_gap = required_staff - staff_assignments.length`, `shortage` flag, `current_ratio_policy` (ratio vs field trip source).
- Essential for shortage view, break conflict detection, and ratio enforcement before leaving `draft`.

### EnrollmentGroup
- `id`, `segment_block_id`, `child_count`, `source` (`roster`, `manual_adjustment`, etc.), `updated_at`, `notes`.
- Provides the child counts that fuel `SegmentBlock` ratios and shortage warnings.

### StaffAssignment
- `id`, `segment_block_id`, `employee_id`, `assignment_source`, `is_substitute`, `substitute_request_id`, `start_time`, `end_time`, `status`, `role`, `created_by`, `created_at`, `notes`.
- Opposite view used to compute shift lengths, guard against daily/weekly max hours, and qualify coverage.
- When `is_substitute`=true, references `SubstituteRequest`; the assigned employee must satisfy the same ratio/certification requirements.

### ShiftBreak
- `id`, `assignment_id`, `start_time`, `end_time`, `break_type`, `approved_by`, `approved_at`, `notes`, `policy_citation_id`.
- Captures required rest/meal coverage and blocks any break that would drop coverage below `SegmentBlock.required_staff`.

### SubstituteRequest
- `id`, `original_assignment_id`, `segment_block_id`, `replacement_employee_id`, `requested_by`, `requested_at`, `state`, `reason`, `approver_id`, `approved_at`, `policy_citation_id`, `notes`.
- Stores metadata visible to the rules engine for parity checks and to the audit trail for compliance reporting.

### FieldTripEvent
- `id`, `schedule_week_id`, `day_of_week`, `segment`, `field_trip_type_id`, `approver_id`, `signed_off_at`, `notes`.
- Blocks `SegmentBlock`s from progressing without a director sign-off and supplies alternate ratios.

### Employee
- `id`, `name`, `contact_info`, `job_title`, `home_school_id`, `max_hours_per_day`, `max_hours_per_week`, `employment_status`, `notes`.
- Derived booleans: `leader_qualified`, `medically_delegated`, `cpr_current` (from certifications). Rules check these before allowing assignments or substitutes.

### Certification
- `id`, `employee_id`, `type`, `issued_at`, `expires_at`, `document_reference`, `policy_citation_id`, `notes`.
- Derived: `is_current = expires_at > now`; scheduling surfaces warnings when assignments depend on soon-to-expire credentials.

### AvailabilityWindow
- `id`, `employee_id`, `day_of_week`, `segment`, `start_time`, `end_time`, `notes`.
- Helps the optimizer match staff to shortage windows without violating daily/weekly limits.

### AuditEvent, ScheduleSnapshot, ChangeJournalEntry
- `AuditEvent`: `target_type`, `target_id`, `actor_id`, `timestamp`, `action`, `changes`, `policy_citation_id`, `notes`. Immutable compliance log per mutation.
- `ScheduleSnapshot`: captures `schedule_week_id`, `captured_at`, `captured_by`, `payload`, `reason`. Immutable view for approvals/reports.
- `ChangeJournalEntry`: staging intent (`action`, `target_type`, `payload`), `status`, `synced_at`, and optional `policy_citation_id`. Keeps offline edits traceable and ties to the audit trail.

## Data Lifecycle Notes
1. `SchoolProfile` aggregates ratios, templates, and policy citations for downstream weeks.
2. Creating or cloning a `ScheduleWeek` copies `SegmentRequirementTemplate`s → new `SegmentBlock`s and `EnrollmentGroup` counts feed `required_staff` calculations.
3. Assignments/breaks/substitutes write `ChangeJournalEntry`s, run through the rules engine, then persist as concrete entities, while `AuditEvent`s, `ScheduleSnapshot`s, and `PolicyCitation`s stay linked to satisfy traceability.
4. Approved schedules become immutable snapshots; `ChangeJournalEntry`s replay failed/pending intents to keep offline-first workflows syncable.
5. Monitoring `Certification.expires_at` and `FieldTripEvent.signed_off_at` ensures future compliance and director approvals are surfaced before submission.
