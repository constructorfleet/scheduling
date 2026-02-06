# Product & Domain Agent Deliverables

## Rules Catalog
1. **PD-R1 – Segment ratio enforcement (per schedule type/field trip)**
   - Source: `SegmentBlock` + `RatioProfile` in `DOMAIN_MODEL.md` along with `FieldTripEvent` overrides.
   - Description: Every active segment block must staff the number of adults required by the selected `ScheduleType` (or by the linked `FieldTripType` when a signed-off field trip changes ratios). Leader support is enforced when `ratioProfile.leaderRequired` is true.
   - Testable: Verify `RequiredStaff = max(requirement.minStaff, ceil(childCount / childrenPerStaff))` and that each block with `fieldTripEventId` either uses the field trip ratios or reports the field-trip-specific violation when adults/leaders fall short.

2. **PD-R2 – Certification coverage per block**
   - Source: `SegmentRequirementTemplate` and `Certification` derivations from `DOMAIN_MODEL.md`.
   - Description: Assignments in any segment must include employees with active `cpr_current`, `medical_delegated`, and `leader` qualifications whenever the requirement template flags them. Expired certifications automatically invalidate the assignment.
   - Testable: Feed segments with intentional qualification gaps to the rules engine; expect one violation per missing certification that names the requirement and cites the `PolicyCitation`.

3. **PD-R3 – Time-window validity & multi-block coverage**
   - Source: `SegmentBlock` timeline rules and `OperatingHours` guidance, plus UI requirement to accept multiple non-contiguous blocks.
   - Description: Clock-in/clock-out windows must fall within the configured operating hours for the selected day and must not overlap other blocks for the same day. Users can create multiple discrete blocks (e.g., morning and afternoon shifts) per staff member, but each block must have `startTime < endTime` and sit inside the operating window.
   - Testable: Create two overlapping blocks and a block with reversed start/end to ensure violations cite the offending block(s); additionally enforce that any time outside `OperatingHours` triggers a violation.

4. **PD-R4 – Validation lifecycle (auto-clear, no manual ack)**
   - Source: `ValidationViolation` definition in `DOMAIN_MODEL.md` plus AGENTS instructions.
   - Description: Validation violations remain `active` until all dependent data (enrollment, assignments, certifications, event approvals) satisfy the rule; the UI must not allow manual acknowledgment. Any edit (e.g., new assignment, enrollment change) re-runs the engine and clears violations once success criteria are met.
   - Testable: Introduce a violation (ratio, certification, missing metadata), then edit the schedule to resolve it and confirm the violation disappears without user intervention.

5. **PD-R5 – Field trip overrides and sign-off**
   - Source: `FieldTripEvent`, `FieldTripType`, and `policy` references in `DOMAIN_MODEL.md`.
   - Description: Every day must point to a `FieldTripEvent` that either references a configured `FieldTripType` (enforcing adult/leader ratios) or explicitly marks `isNoFieldTrip`. Each event also requires `approverId` and `signedOffAt` before the week can transition out of `ready_for_review`.
   - Testable: Attempt to save a week where a day’s event lacks a type or sign-off metadata; expect violations that list the missing pieces in `metadata.missing`, plus blocked status changes until data is completed.

6. **PD-R6 – Substitute parity & approvals**
   - Source: `SubstituteRequest` + assignment metadata from `DOMAIN_MODEL.md`.
   - Description: A substitute assignment must reference an approved request (`state = approved`) with `approverId`, `approvedAt`, `reason`, and a valid `policyCitationId`. The replacement employee must satisfy the same ratio/certification restrictions as the original slot.
   - Testable: Create substitute assignments with missing metadata or insufficient qualifications; confirm violations enumerate each missing field and prohibit saving until parity is restored.

7. **PD-R7 – Shift length/break limits**
   - Source: `Employee.max_hours_per_day`/`max_hours_per_week`, `ShiftBreak` model in `DOMAIN_MODEL.md`.
   - Description: No single assignment or aggregated daily/weekly assignments may exceed an employee’s configured caps. Breaks may not be approved if they would drop required coverage below the segment minimum.
   - Testable: Assign hours exceeding daily/weekly limits to trigger violations, then insert a break that leaves the block understaffed to ensure the rules engine prevents break creation.

8. **PD-R8 – Schedule day metadata completeness**
   - Source: `ScheduleDay` validation constraints in `DOMAIN_MODEL.md`.
   - Description: Every schedule day must store a `scheduleType`, `enrollmentCount`, and a linked `FieldTripEvent` (or an explicit “No Field Trip” flag). Without this metadata, no downstream ratio/coverage computation can run.
   - Testable: Create a `ScheduleDay` missing any of the required fields and verify that `schedule-day-metadata` violations enumerate the missing properties.

9. **PD-R9 – Audit & journal integrity**
   - Source: `AuditEvent` and `ChangeJournalEntry` definitions.
   - Description: Every manual change (schedule creation, assignment update, substitute approval) writes an `AuditEvent`/`JournalEntry` that includes the relevant `PolicyCitation`. Approved/archived weeks are immutable, but their snapshots remain queryable for compliance reviews.
   - Testable: Monitor audit logs/journal entries after each CRUD operation; verify the serialized payloads, actor metadata, and policy citations are present and that approved weeks reject edits.

## User Stories
1. **Site Director defines a weekly schedule**
   - As a site director I want to choose a `ScheduleType` per day, enter enrollment counts, attach field-trip decisions, and create multiple non-contiguous segment blocks so I can describe the actual coverage each day.
   - Acceptance: Each day records the required metadata, block timelines stay within operating hours, and the rules engine immediately surfaces any ratio/certification violations before I mark the week `ready_for_review`.

2. **Scheduling coordinator assigns staff with compliance guidance**
   - As a scheduling coordinator I want to assign employees to each segment block, including substitutes, while the UI indicates whether staff hold the needed certifications, satisfy leader requirements, and keep daily/weekly caps.
   - Acceptance: Assignments reference the staff’s qualifications, substitute metadata requirements are enforced, and violation messaging pinpoints the missing certification or coverage gap.

3. **Substitute coordinator configures staff profiles and approvals**
   - As a substitute coordinator I need to add/remove staff, update certifications (CPR, medical delegation, leader), and be able to review and approve substitute requests within the web UI so every assignment remains compliant.
   - Acceptance: Configuration flows let me edit employees, upload certifications, and specify max hours; each change retriggers validation and the list of active violations updates automatically (without a manual “addressed” switch).

4. **Compliance reviewer validates field trips**
   - As a compliance reviewer I must ensure every field trip event is linked to a configured `FieldTripType`, signed off by a director, and audited before final submission so ratios and approvals never rely on guesswork.
   - Acceptance: The reviewer cannot move a week from `ready_for_review` to `submitted` if any field-trip event lacks type references or sign-off metadata, and the UI links each violation back to the missing metadata piece.

5. **Administrator maintains ratio/certification profiles**
   - As an administrator I want to configure ratio profiles, minimum staff, and certification requirements in the settings panel so the rules engine always references the current district policy.
   - Acceptance: Changes to ratio/certification templates are persisted, referenced in new requirement templates, and applied to revalidated segment blocks; historical weeks remain immutable but still show the ratios they were evaluated against.

## Edge-case Scenarios
1. **Overlapping blocks when planners accidentally duplicate time windows**
   - Scenario: Two segment blocks for the same day share overlapping times; one is created by copying a template while the other is manually added.
   - Expectation: The later block triggers a `segment-block-timeline` violation that references the first block’s id and prevents the overlap from being saved.

2. **Field-trip type removed mid-week**
   - Scenario: A director deletes a `FieldTripType` after some days already reference it.
   - Expectation: Each impacted `ScheduleDay` immediately shows a violation requiring either a new type or an explicit `isNoFieldTrip` flag, and the schedule cannot transition out of `draft` until they resolve it.

3. **Break insertion that drops coverage below minimum**
   - Scenario: A call to insert a `ShiftBreak` would remove the only leader-qualified staff from a block with `leaderRequired = true`.
   - Expectation: The system blocks the break, surfaces a `segment-coverage` warning, and suggests adding another qualified staffer before the break can exist.

4. **Employee with multiple non-contiguous working blocks crosses daily/weekly caps**
   - Scenario: An employee has a morning block, a midday block for a field trip, and a late-afternoon block; the sum crosses their `max_hours_per_day` or `max_hours_per_week`.
   - Expectation: `shift-break-limits` violations reflect the exceeded cap(s); the UI flags the precise blocks responsible so the scheduler can redistribute the workload.

5. **Schedule day missing required metadata**
   - Scenario: A day is created without `scheduleType`, leaving enrollment and field-trip data blank after quickly copying forward a template.
   - Expectation: `schedule-day-metadata` raises violations for each missing field, and the scheduler must fill them before any ratio checks run.

6. **Substitute lacks approved request metadata**
   - Scenario: A substitute assignment is created while the approval request stays `pending` and lacks `approverId`/`approvedAt`.
   - Expectation: `substitute-parity` violations enumerate the missing metadata, and the schedule cannot move forward until the request is fully approved and linked.

7. **Operating-hours boundary violation**
   - Scenario: A block starts before `OperatingHours.open` or ends after `close` when a scheduler copies a template that spans beyond the day’s configured window.
   - Expectation: A timeline violation names the block, the invalid timestamp, and prevents saving until the block is adjusted inside the operating window.
