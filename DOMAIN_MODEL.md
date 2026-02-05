# Domain Model (Expanded)

This document describes the core entities, enumerations, and validation points the Data Model Agent owns for the scheduling application. The design keeps scheduling, compliance, and audit needs explicit while remaining storage-agnostic (e.g., IndexedDB snapshots, JSON payloads, etc.).

## Enumerations
- `JobTitle` – District-provided list such as `Director`, `Assistant Director`, `Leader`, `Support Leader`, `Assistant`. `Leader`-level status (used in coverage rules) is derived when the title is `Leader` or higher in the published hierarchy.
- `DayScheduleType` – `closed`, `in_house`, `full_day`, `school_day`; determines the operating hours when combined with `DayOfWeek`.
- `DaySegment` – `open`, `mid`, `close`.
- `DayOfWeek` – `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`.
- `TripDay` – `yes`, `no`.
- `AssignmentSource` – `template`, `manual_adjustment`, `field_trip_override`, `substitute`, `import`.
- `ApprovalState` – `pending`, `approved`, `rejected`.
- `CPRCertification` – `none`, `current`, `lapsed`.
- `MedDelegated` - `yes`, `no`.
- `AuditAction` – `create`, `update`, `delete`, `approve`, `reject`, `snapshot`.
- `ScheduleStatus` – `draft`, `ready_for_review`, `submitted`, `approved`, `archived`.
- `ShiftStatus` – `scheduled`, `active`, `on_break`, `completed`.
- `BreakType` – `meal`, `rest`, `coverage`, `other`.
- `CertificationType` – `cpr`, `first_aid`, `medical_delegation`, `other`.
- `EmploymentStatus` – `active`, `on_leave`, `archived`; controls whether an employee is eligible to carry assignments or must be bypassed during scheduling.
- `JournalEntryStatus` – `pending`, `synced`, `failed`; indicates whether a persisted intent/journal record has been committed to the host or still needs reconciliation.

## Entities

### PolicyCitation
- `id` (string, required)
- `name` (string, required) – e.g., “CPR coverage for open segment”
- `document` (string, required) – policy or district reference
- `section` (string, optional)
- `url` (string, optional)
- `notes` (string, optional)
> Used to tie ratio, capacity, certification, med-delegated, and field-trip rules to a documented source.

### SchoolProfile
- `id`, `name`, `district_id`
- `timezone` (IANA string)
- `primary_contact` (staff or director reference)
- `notes`
> Owns `DayScheduleTemplate`s, `ScheduleWeek`s, employees, and policy references.
> Relates to `OperatingHours`

### OperatingHours
- `school_id`
- `open`
- `close`
- `day_schedule_type`
- `day_of_week` list


### RatioProfile
- `id`, `age_group_profile_id`
- `segment` (`DaySegment`)
- `children_per_staff` (number > 0)
- `leader_required` (bool)
- `policy_citation_id`
- `notes`
> Derived staffing minimum: `required_staff = ceil(child_count / children_per_staff)` plus leader guardrail when `leader_required` is true.

### FieldTripType
- `id`, `name`
- `min_adult_student_ratio` (adults per student)
- `min_leader_student_ratio`
- `policy_citation_id`
- `notes`
> Applied whenever a `FieldTripEvent` overrides a `SegmentBlock`.

### DayScheduleTemplate
- `id`, `school_id`
- `name`, `type` (`DayScheduleType`)
- `created_by`, `created_at`
- `notes`
- `segment_requirements` (list of `SegmentRequirementTemplate` references)
> Reusable pattern for weekly schedules; copy-forward seeds `ScheduleWeek`.

### SegmentRequirementTemplate
- `id`, `template_id`
- `segment` (`DaySegment`)
- `ratio_profile_id`
- `min_staff`
- `requires_cpr`, `requires_medical_delegation`, `requires_leader` (bool)
- `policy_citation_id`
- `notes`
> Defines per-segment certification and staffing expectations. The scheduler copies these into `SegmentBlock`s.

### ScheduleWeek
- `id`
- `school_id`
- `template_id`
- `start_date` (Monday of the week)
- `status` (`ScheduleStatus`)
- `created_by`, `created_at`
- `submitted_by`, `submitted_at`
- `approved_by`, `approved_at`
- `notes`
> Tracks the lifecycle of a weekly schedule and drives snapshots/audit events when state transitions happen.

### SegmentBlock
- `id`
- `schedule_week_id`
- `day_of_week`
- `segment` (`DaySegment`)
- `start_time`, `end_time`
- `child_count` (aggregate from `EnrollmentGroup`)
- `requirement_template_id`
- `status` (`ScheduleStatus`)
- `field_trip_event_id` (optional)
- `operating_capacity_override` (optional)
- `closed_reason`
- `last_updated_by`, `last_updated_at`
> Derived:
  - `required_staff = max(requirement.min_staff, ceil(child_count / ratio.children_per_staff))`
  - `coverage_gap = required_staff - staff_assignments.length`
  - `shortage` flag when `required_staff > staff_assignments`.
> `FieldTripEvent`s mark the block as off-site and change the ratio source.

### EnrollmentGroup
- `id`
- `segment_block_id`
- `child_count`
- `source` (`roster`, `manual_adjustment`, etc.)
- `updated_at`
- `notes`
> Captures how many children are scheduled per block for capacity and ratio math.

### StaffAssignment
- `id`
- `segment_block_id`
- `employee_id`
- `assignment_source` (`AssignmentSource`)
- `is_substitute` (bool)
- `substitute_request_id` (optional)
- `start_time`, `end_time`
- `status` (`ShiftStatus`)
- `role` (text for ad-hoc roles)
- `created_by`, `created_at`
- `notes`
> Opposite view of `SegmentBlock` to compute shift length and coverage.

### ShiftBreak
- `id`
- `assignment_id`
- `start_time`, `end_time`
- `break_type` (`BreakType`)
- `approved_by`, `approved_at`
- `notes`
> Ensures regulatory breaks are captured; scheduling rules consult the gap between `StaffAssignment` segments and these records.

### SubstituteRequest
- `id`
- `original_assignment_id`
- `segment_block_id`
- `replacement_employee_id`
- `requested_by`
- `requested_at`
- `state` (`ApprovalState`)
- `reason`
- `approver_id`
- `approved_at`
- `policy_citation_id`
- `notes`
> Captures approval metadata and enforces parity (certification/ratio) before plugging the substitute into `StaffAssignment`.

### FieldTripEvent
- `id`
- `schedule_week_id`
- `day_of_week`
- `segment`
- `field_trip_type_id`
- `approver_id`
- `signed_off_at`
- `notes`
> When linked to `SegmentBlock`s, the engine uses `FieldTripType` ratios.

### Employee
- `id`
- `name`
- `contact_info`
- `job_title` (`JobTitle`)
- `home_school_id`
- `max_hours_per_day`
- `max_hours_per_week`
- `employment_status` (`active`, `on_leave`, `archived`)
- `notes`
> Derived booleans: `leader_qualified`, `medically_delegated`, `cpr_current` via `Certification`s.

### Certification
- `id`
- `employee_id`
- `type` (`CertificationType`)
- `issued_at`
- `expires_at`
- `document_reference`
- `policy_citation_id`
- `notes`
> Derived flag `is_current = expires_at > now`. Rules warn when assignments rely on soon-to-expire certifications.

### AvailabilityWindow
- `id`
- `employee_id`
- `day_of_week`
- `segment` (`DaySegment`)
- `start_time`, `end_time`
- `notes`
> Used to filter qualified matches during shortages or substitute searches.

### AuditEvent
- `id`
- `target_type` (`ScheduleWeek`, `SegmentBlock`, `StaffAssignment`, `SubstituteRequest`, etc.)
- `target_id`
- `actor_id`
- `timestamp`
- `action` (`AuditAction`)
- `changes` (structured diff or narrative)
- `policy_citation_id` (optional)
- `notes`
> Immutable trail for compliance reviews; every manual override or approval writes an event.

### ScheduleSnapshot
- `id`
- `schedule_week_id`
- `captured_at`
- `captured_by`
- `payload` (serialized schedule state)
- `reason`
> Stored when a schedule is submitted, approved, or manually archived so auditors can replay the state.

### ChangeJournalEntry
- `id`
- `schedule_week_id`
- `actor_id`
- `timestamp`
- `action` (`AuditAction`)
- `target_type` (entity being mutated, e.g., `SegmentBlock`, `StaffAssignment`)
- `target_id`
- `payload` (intent or diff that produced the change)
- `policy_citation_id` (optional)
- `notes`
- `status` (`JournalEntryStatus`)
- `synced_at` (optional timestamp when the entry was replayed by the host)
> Captures every offline/intended mutation as a journal entry so the persistence layer can replay it, keep audit trails aligned, and surface pending changes before they are committed.

## Relationships
- `SchoolProfile` 1→* `DayScheduleTemplate`, `ScheduleWeek`, `Employee`, `RatioProfile`.
- `DayScheduleTemplate` owns `SegmentRequirementTemplate`s that seed `SegmentBlock` requirements.
- `ScheduleWeek` 1→* `SegmentBlock`, `FieldTripEvent`, `ScheduleSnapshot`, `AuditEvent`, `ChangeJournalEntry`.
- `SegmentBlock` 1→* `EnrollmentGroup`, `StaffAssignment`; it links back to a `SegmentRequirementTemplate`, and (optionally) a `FieldTripEvent`.
- `StaffAssignment` references one `Employee`, zero or one `SubstituteRequest`, and 0..* `ShiftBreak`s.
- `Employee` 1→* `Certification`, `AvailabilityWindow`, `StaffAssignment`, `AuditEvent`.
- `SubstituteRequest` records `policy_citation_id`, links the replaced assignment to the ad-hoc replacement, and flows into `StaffAssignment`s marked `is_substitute`.
- `FieldTripEvent` points to a `FieldTripType` and the `SegmentBlock`s it overrides via `field_trip_event_id`.
- `AuditEvent` and `ScheduleSnapshot` tie all key operations back to `ScheduleWeek` for archival/audit exports.
- `ChangeJournalEntry` links the staged intent to a final `AuditEvent`/`ScheduleSnapshot`, keeping offline edits traceable and enabling export-ready deltas.

## Persistence & Indexing
- The domain tables are persisted via IndexedDB (e.g., Dexie) so the workspace stays functional offline. Each entity—`SchoolProfile`, `RatioProfile`, `DayScheduleTemplate`, `ScheduleWeek`, `SegmentBlock`, `EnrollmentGroup`, `StaffAssignment`, `ShiftBreak`, `SubstituteRequest`, `FieldTripEvent`, `Employee`, `Certification`, `AvailabilityWindow`, `AuditEvent`, `ScheduleSnapshot`, and `ChangeJournalEntry`—gets its own store with AJV-backed validation that rejects stale or invalid payloads.
- Recommended indexes follow the `staffId`, `date` strategy and the most common queries:
  - `ScheduleWeek`: compound index on `(school_id, start_date)` for week selection.
  - `SegmentBlock`: indexes on `(day_of_week, schedule_week_id)` plus `field_trip_event_id` for coverage/shortage lookups.
  - `StaffAssignment`: indexes on `(employee_id, segment_block_id, schedule_week_id)` to answer staffing, shift-length, and substitute queries.
  - `ChangeJournalEntry`: indexes on `(status, schedule_week_id, timestamp)` so pending intents surface quickly for sync reconciliation.
  - `AuditEvent`: indexes on `(target_type, target_id, timestamp)` for exports and audit reviews.
  - `EnrollmentGroup`: index on `segment_block_id`; `FieldTripEvent`: `(schedule_week_id, day_of_week)`.
  - `Employee`: `home_school_id` and `employment_status`; `Certification`: `employee_id`.
- PII (names, contact info) resides in `Employee` and `SchoolProfile`. Retention/purge policies should align with district FERPA/PII plans (e.g., remove archived employees after a set window, encrypt snapshots) even though enforcement happens in the persistence layer.

## Data Lifecycle
- `SchoolProfile` gathers ratios, certifications, and policy citations; `DayScheduleTemplate`s and their `SegmentRequirementTemplate`s define the expected staffing, certifications, and capacities that seed each week.
- When a coordinator clones or creates a `ScheduleWeek` (`status = draft`), the scheduler copies template blocks/requirements and populates `EnrollmentGroup` counts from rosters or manual entries. `SegmentBlock`s compute `required_staff`, `coverage_gap`, and the `shortage` flag as soon as child counts are known so the shortage view can highlight needing staffing before the schedule is saved.
- Scheduling actions (assigning staff, substituting, declaring field trips, capturing breaks) first emit a `ChangeJournalEntry` and then run the rules engine. Every compliant intent persists as `StaffAssignment`, `ShiftBreak`, `SubstituteRequest`, etc., while violations are blocked and surfaced with the corresponding `PolicyCitation`. `ChangeJournalEntry`s remain `pending` until an `AuditEvent` and (when applicable) `ScheduleSnapshot` confirm persistence, keeping offline workflows recoverable.
- Submission moves `ScheduleWeek` through `ready_for_review`, `submitted`, and `approved`; approvals record `FieldTripEvent` sign-offs, `SubstituteRequest` approver metadata, and the exact `StaffAssignment` + `ShiftBreak` configuration in `ScheduleSnapshot` for auditors. Break and shift rules keep only compliant assignments; the shortage view re-triggers if gaps appear during this process.
- Approved (`status = approved`) or archived schedules stay immutable, but the journal and snapshot stores provide replayable history for compliance reviews and `<30-minute` scheduling metrics. If a sync target is later available, `ChangeJournalEntry`s in `failed` or `pending` state can be replayed in order, while `AuditEvent`s keep the audit log intact. Ongoing monitoring of `Certification.expires_at` ensures future saves warn about soon-to-expire credentials that would invalidate future assignments.

## Validation Constraints (mapped to rules catalog)
- **Time segment ratios**: Each `SegmentBlock` compares `child_count` (from `EnrollmentGroup`) to the `RatioProfile` attached to its `SegmentRequirementTemplate`. `StaffAssignment` count must be ≥ `ceil(child_count / children_per_staff)` before the schedule moves out of `draft`.
- **Certification requirements per time segment**: `SegmentRequirementTemplate` defines `requires_cpr`, `requires_medical_delegation`, `requires_leader`. `StaffAssignment`s must include at least one `Employee` whose active `Certification`s satisfy each requirement; violations cite the associated `PolicyCitation`.
- **Break and shift length limits**: `StaffAssignment` durations are bounded by the `Employee.max_hours_per_day`. Weekly totals (sum of assignments within `ScheduleWeek`) are measured against `Employee.max_hours_per_week`. `ShiftBreak`s capture the guarded time span and a violation surfaces the contested `start`/`end`.
- **Time segment coverage**: For block segments, the aggregated `StaffAssignment`s must meet the configured requirements for that segment's `DayOfWeek` and `DayScheduleType`; blocking violations mention the missing role and reference the `SegmentBlock`.
- **Substitute parity and approvals**: Whenever `is_substitute` is true, a `SubstituteRequest` must exist with `state = approved`, `approver_id`, `reason`, and the replacement `Employee` must pass all the ratio and certification checks that applied to the original assignment.
- **Field trip ratio overrides**: `FieldTripEvent`s link to `FieldTripType`s that define `min_adult_student_ratio` and `min_leader_student_ratio`. Segments flagged with `field_trip_event_id` ignore the base `RatioProfile` and enforce the field-trip ratios while keeping coverage logs in `StaffAssignment`s.
- **Certification expirations**: `Certification.expires_at` must be future-dated before an assignment references the employee; the system flags future saves when linked certifications are within the “expiring soon” window defined in policy.
- **Field trip overrides and director sign-off**: Every `FieldTripEvent` requires `approver_id` and `signed_off_at`; missing approvals block the schedule from leaving `ready_for_review`.
- **Shortage view and break conflicts**: Derived `SegmentBlock.coverage_gap` drives the shortage view. When a single qualified adult is the only assignment and a `ShiftBreak` would drop coverage below required staff, the model surfaces the conflict and blocks the break entry until an additional assignment appears.
- **Auditability**: Every change to `ScheduleWeek`, `SegmentBlock`, `StaffAssignment`, and `SubstituteRequest` generates an `AuditEvent` with the relevant `policy_citation_id`. Prior versions are stored via `ScheduleSnapshot` so auditors can replay the exact configuration.
