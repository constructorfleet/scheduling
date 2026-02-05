# Scheduling Application Project Charter

## Overview
Build a standalone scheduling application for a school district’s daycare system. The app will be used at each school to generate and manage compliant staff schedules. Users are non-technical; the experience must be intuitive, guided, and error-resistant.

## Goals
- Produce compliant schedules that honor daycare regulations and district policies.
- Provide an intuitive UI for non-technical users with clear, guided workflows.
- Be maintainable, extensible, configurable, and deployable as a standalone HTML5 app.
- Include unit and integration tests and clear documentation (technical + lay-person with screenshots).

## Non-Goals (for initial release)
- Automated payroll processing.
- Real-time multi-user collaboration across schools.
- Complex HR systems integration (can be a future extension).

## Primary Users
- Site directors
- Scheduling coordinators
- Substitute coordinators

## Key Capabilities (Initial Scope)
- School and staff profiles, qualifications, certifications, availability, and restrictions.
- Compliance rules engine (ratios, max group size, qualification requirements, break rules, etc.).
- Schedule templates and copy-forward from prior weeks.
- Conflict detection with guided resolution.
- Export/print schedules (PDF, CSV).
- Audit trail for changes.

## Compliance & Rules
- Staff-to-child ratios by field trip event, schedule type, and time of day.
- Required certifications per time and field trip event.
- Staff break requirements and shift length limits.
- Coverage requirements for time block segments.
- Substitute rules and approval flow.

## Architecture Principles
- Standalone HTML5 app (static assets) with offline-first behavior.
- Clear domain modeling and separation of concerns.
- Rules engine as a dedicated module with testable rule definitions.
- Configuration panel for specifying certifications, ratios, operating hours, etc.
- Data persistence via IndexedDB or a lightweight embedded store.
- Optional sync layer as a future extension.

## Quality & Testing
- Unit tests for domain logic and rules.
- Integration tests for scheduling flows and critical UI paths.
- Test data fixtures and scenario-based rule validations.

## Documentation
- Technical docs: architecture, data model, rules system, build/deploy.
- User docs: task-based guides with screenshots.
- Quick-start checklist for new site directors.

## Success Criteria
- A scheduler can produce a compliant weekly schedule in under 30 minutes.
- Compliance violations are clearly detected with actionable guidance.
- At least 80% of new users can complete core tasks without training.

## Risks & Open Questions
- Data privacy requirements (FERPA/PII handling).
## Proposed Milestones
1. Discovery and requirements (rules, workflows, data).
2. Domain model + rules engine design.
3. MVP scheduling UI with validation.
4. Export/print and audit trail.
5. Testing + documentation.
6. Pilot at one school; iterate.

