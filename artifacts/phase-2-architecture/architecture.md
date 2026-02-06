# Solution Architecture Blueprint

## Purpose & Constraints
- Reference: the Product & Domain agent rules catalog, user stories, and edge cases in `artifacts/phase-1-requirements/product-domain-agent-deliverables.md`, which spell out ratio/certification, field-trip approval, enrollment metadata, operating-hour, validation lifecycle, substitute-parity, and clock-based shift requirements.
- Constraint: the system must run as a standalone HTML5 deployment (bundled via Vite), support guided, non-technical scheduling workloads, and keep every validation active until the underlying clock-in/clock-out data satisfies the policy (no manual "addressed" toggles).
- Scheduling guarantees: staff can own multiple non-contiguous working blocks per day, all blocks must stay inside configured operating hours, and users must be able to add/remove staff, certifications, ratios, and schedules entirely through the UI.

## Architecture Overview
The browser hosts a static Vite/React bundle that drives every capability. Inputs (clock entries, staff assignments, field-trip selectors, schedule-type dropdowns, certification edits) flow through the UI into a typed domain model, which both persists state and feeds the rules engine. The rules engine emits structured `ValidationViolation`s that loop back to the UI/ guided tracker so the publish gate stays blocked until compliance is restored. Persistence, audit exports, and configuration settings all react to the same domain events, keeping the architecture modular and testable.

### Deployment Graph
```
             +--------------------+
             | HTML5 Shell (Vite + |
             | React bundle served | 
             | from dist/          |
             +---------+----------+
                       |
             +---------v----------+
             | UI Layer (guided    |
             | scheduler, palettes,|
             | violation navigator)|
             +---------+----------+
                       |
           +-----------v-----------+
           | Domain & State Models  |
           | (schedule weeks/days, |
           | segment blocks,       |
           | employees, field trips,|
           | certifications, enums)|
           +-----+-------+---------+
                 |       |
    +------------v+     +-v--------------+
    | Rules Engine |     | Persistence &  |
    | (ratios,     |     | Journals (IDB,  |
    | certifications,|   | snapshots, exports)|
    | field trips, |     +------------------+
    | substitutes) |            |
    +------+-------+            V
           |                     |  Audit/exports bundle
           |                     v
    +------v------+      +-------+--------+
    | Guided UI    |      | Reporting &    |
    | Validation   |      | Audit Snapshot |
    | State (violations|   | generators     |
    | , publish gate)|   +----------------+
    +--------------+
```
Every arrow represents a typed event stream. The UI pushes intent into domain models, the rules engine declares violations that the UI renders, and persistence captures the full journal (ensuring approved/archived weeks remain immutable while still replayable for audits). Export generators tap the same data to produce PDF/CSV compliance reports and can later pipe into remote sync workflows.

## Module Boundaries
- **UI Layer (`src/ui`)**: Hosts the ScheduleGrid, StaffPalette, ViolationNavigator, Guided Status Tracker, and Configuration panels. It captures clock-in/out times (allowing multiple disjoint blocks) and enrollment/field-trip metadata, highlights validation blockers, and ties scheduling steps (plan → review → publish) to the rules engine outputs. All configuration flows (employees, certifications, ratios, field trips) run here so non-technical users never need a CLI or external tool.
- **Domain & Model Layer (`src/domain`)**: Encapsulates typed entities such as `ScheduleWeek`, `ScheduleDay`, `SegmentBlock`, `StaffAssignment`, `FieldTripEvent`, `RatioProfile`, `Certification`, `Employee`, `OperatingHours`, `ValidationViolation`, `PolicyCitation`, and journal/audit entries. Domain helpers compute required staff (`ceil(child_count / children_per_staff)`), coverage gaps, and substitution parity, and they enforce that every schedule day stores metadata before ratio math can run.
- **Rules Engine (`src/rules`)**: Isolated module that evaluates ratio/certification requirements, field-trip overrides, substitute approvals, operating-hour windows, overlap detection, shift/break caps, and validation lifecycles (violations stay `active` until the domain state resolves them). The engine outputs structured violations with policy citations so the UI can block transitions (e.g., ready_for_review → submitted) while explaining why.
- **Persistence (`src/storage`)**: Journals every action into IndexedDB (and optional JSON snapshots) so offline deployments keep working. Stores `ScheduleWeek`, `FieldTripType`, `Employee`, `Certification`, validation snapshots, audit events, and change journal entries with the indexes needed for fast lookups (e.g., `(schedule_week_id, date)`, `(employee_id, segment_block_id)`). Persistence also owns export-ready snapshots so approved weeks stay immutable yet replayable.
- **Configuration & Settings**: A UI + domain binding layer for maintaining employees, certifications, ratio requirements, field-trip types, schedule/home school metadata, and operating hours. Adjustments here immediately emit domain events, retrigger the rules engine, and update validations without manual acknowledgement.
- **Audit & Export Services**: Utilities that consume persisted journals/violations to emit PDF/CSV compliance packets, log policy citations, and support replay for compliance reviews or future sync layers. Export pipelines reuse the same domain events so nothing is duplicated.

## Tech Stack Decisions
- **TypeScript + React 18 + Vite 5** (see `package.json`): Enables the static HTML5 requirement while enforcing shared domain contracts and delivering the interactive guided UI. Vite builds the offline-ready bundle stored under `dist/` and `dist-static/*` tarballs.
- **AJV**: Powers schema validation when persisting to IndexedDB so malformed updates/references (e.g., orphaned field-trip types) are rejected before ruining a week’s compliance state.
- **Jest + React Testing Library + Playwright**: Jest covers domain helpers and the rules engine, RTL targets guided workflows and violation messaging, and Playwright secures the core e2e path. All suites run locally (`npm test`, `npm run test:e2e`) before building the static bundle.
- **IndexedDB/JSON Journals**: Offline-first persistence, journaling, and snapshot exports keep every change traceable (`ScheduleSnapshot`, `AuditEvent`, `ChangeJournalEntry`). This storage layer keeps approved weeks read-only yet queryable for auditors.
- **Shell scripts + metadata (`scripts/build-static.sh`, `build-metadata.json`)**: Produce reproducible static artifacts. The architecture keeps deployment as a simple upload of `dist-static-<timestamp>.tar.gz`, satisfying the standalone HTML5 requirement.

## Extensibility Considerations
1. **Rules Plugins**: The rules engine exposes typed hooks that can accept new constraints (e.g., future ratio policies, new break rules) without touching the UI. Each rule returns a `ValidationViolation` with a `policy_citation_id`, keeping compliance traceable.
2. **Persistence Adapters**: The journaled storage exposes an append-only stream; future sync layers can tap this stream or replace the IndexedDB backend with remote storage while the UI and rules logic stay unchanged.
3. **Configuration Extensions**: Adding support for new certification types, ratio templates, or schedule categories only requires new entries in the configuration UI and domain enums; the rules engine reads those enums dynamically, so no rebuild of core modules is necessary.
4. **Audit/Export Hooks**: Export services subscribe to the same domain events, so shipping new report formats (JSON, Excel, API webhooks) can share the existing pipeline without rewriting the persistence layer.
5. **Plugin-ready Guided Workflow**: The UI’s guided status tracker consumes a small set of violation states; additional steps (e.g., a payroll review) can insert new stages by subscribing to the same event feed without rewiring the entire UI shell.

## Coordination Notes
- Provide this artifact to the Data Model and Rules Engine agents so their entity definitions and rule sets follow the boundaries described above.
- Cover the same diagram in the orchestrated architecture output so downstream agents can reference it via `artifacts/phase-2-architecture/architecture.md`.
