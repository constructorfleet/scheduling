# MVP Backlog

This backlog is organized by epics with user stories and acceptance criteria. Items are prioritized for an initial MVP that can be piloted at one school.

## Legend
- Priority: P0 (must), P1 (should), P2 (could)
- Status: planned, in_progress, blocked, done

## Epic 1: Discovery and Requirements
1. Story: Capture regulatory rules and district policies
- Priority: P0
- Status: planned
- Acceptance Criteria:
- A written rules catalog exists with citations to source documents.
- Each rule is translated into a testable statement.

2. Story: Map current scheduling workflows per school
- Priority: P0
- Status: planned
- Acceptance Criteria:
- At least 3 representative workflows are documented.
- Pain points and manual steps are recorded.

3. Story: Define success metrics and pilot scope
- Priority: P0
- Status: planned
- Acceptance Criteria:
- Pilot school(s) selected and timeline defined.
- Success metrics and baseline are documented.

## Epic 2: Domain Model and Data
4. Story: Define core entities and relationships
- Priority: P0
- Status: planned
- Acceptance Criteria:
- Entities include Staff, Shift, Schedule, Certification, Availability, StaffPosition, RuleViolation, AuditEvent.
- Relationships and constraints are documented.

5. Story: Implement local persistence
- Priority: P0
- Status: planned
- Acceptance Criteria:
- Data saved and restored across sessions using IndexedDB or equivalent.
- Data schema versioning is documented.

6. Story: Seed data and fixtures for testing
- Priority: P1
- Status: planned
- Acceptance Criteria:
- Sample rules, staff, and schedules exist.
- Fixtures cover at least 5 compliance scenarios.

## Epic 3: Rules Engine
7. Story: Implement rule evaluation framework
- Priority: P0
- Status: planned
- Acceptance Criteria:
- Rules run against a schedule and return typed violations.
- Rules are independently unit tested.

8. Story: Implement ratio rules
- Priority: P0
- Status: planned
- Acceptance Criteria:
- Staff-student ratios enforced by time block and per-day.
- Ratios for field trips and staff position levels enforced.

9. Story: Implement qualification and coverage rules
- Priority: P0
- Status: planned
- Acceptance Criteria:
- Required certifications per day and time enforced.
- Opening and closing coverage enforced.

10. Story: Implement break and shift constraints
- Priority: P1
- Status: planned
- Acceptance Criteria:
- Max shift length enforced.
- Break requirements enforced.

## Epic 4: Scheduling UI
11. Story: Create schedule workspace UI
- Priority: P0
- Status: planned
- Acceptance Criteria:
- Users can create a new weekly schedule.
- Users can assign staff to time blocks.
- Users can unassign staff from time blocks.
- Staff can be assigned to non-contiguoous blocks of time (i.e. a morning and afternoon shift).

12. Story: Conflict detection and guided resolution
- Priority: P0
- Status: planned
- Acceptance Criteria:
- Violations are displayed with clear instructions.
- Users can navigate from a violation to the affected schedule block.

13. Story: Templates and copy-forward
- Priority: P1
- Status: planned
- Acceptance Criteria:
- Users can copy a prior week and adjust.
- Template schedules can be saved and reused.

14. Story: Accessibility and usability for non-technical users
- Priority: P0
- Status: planned
- Acceptance Criteria:
- Large, readable typography and clear labels.
- Undo action available for schedule edits.

## Epic 5: Reporting and Export
15. Story: Export schedules to PDF and CSV
- Priority: P1
- Status: planned
- Acceptance Criteria:
- Exported files include week, and staff assignments.
- Export matches on-screen schedule.

16. Story: Print-friendly layout
- Priority: P1
- Status: planned
- Acceptance Criteria:
- Schedule fits on standard letter size with minimal truncation.
- Print preview available.

## Epic 6: Audit and History
17. Story: Audit trail for schedule changes
- Priority: P1
- Status: planned
- Acceptance Criteria:
- Key edits are logged with user, timestamp, and reason.
- Users can view change history for a schedule.

## Epic 7: Testing and Quality
18. Story: Unit test suite for domain logic and rules
- Priority: P0
- Status: planned
- Acceptance Criteria:
- Core rules have coverage.
- Tests run in CI or locally with a single command.

19. Story: Integration tests for scheduling flows
- Priority: P1
- Status: planned
- Acceptance Criteria:
- Create schedule, assign staff, detect conflicts flow is tested.

## Epic 8: Documentation
20. Story: Technical documentation
- Priority: P1
- Status: planned
- Acceptance Criteria:
- Architecture and data model documented.
- Build and deploy steps documented.

21. Story: User guide with screenshots
- Priority: P1
- Status: planned
- Acceptance Criteria:
- Step-by-step guides for creating a schedule and resolving conflicts.
- Screenshots included for key screens.

## Epic 9: Deployment
22. Story: Build and release pipeline
- Priority: P1
- Status: planned
- Acceptance Criteria:
- App builds to static assets.
- Deployment guide exists for local hosting.

23. Story: Versioning and migration strategy
- Priority: P1
- Status: planned
- Acceptance Criteria:
- Data migrations defined for schema changes.
- Rollback or backup guidance documented.

## Assumptions
- The MVP is single-user per machine with local persistence.
- Compliance rules can be encoded deterministically.
- Network access is not required for core use.

