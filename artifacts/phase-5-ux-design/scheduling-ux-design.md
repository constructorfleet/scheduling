# Scheduling UX Blueprint

## Purpose and Design Principles
- **Clock-based clarity for every block:** staff coverage is entered as actual clock-in/clock-out windows that can repeat, overlap, or span breaks, so users always work with the same data the rules engine validates.
- **Guided, plain-language workflow:** every screen describes the next required action, surfaces inline tips (ratio context, missing approvals), and keeps calls to action within 3–4 taps/drags so non-technical coordinators never need training.
- **Compliance visibility without extra clicks:** violations, field trip approvals, child counts, and ratio states appear alongside the workspace; the guided tracker keeps a live status bar that flips to green only when data passes validation (there is no “mark addressed” button—editing the data re-runs the checks and clears flags automatically).
- **Self-service configuration:** staff/cert rosters, ratio profiles, field trip types, and schedule-type definitions are managed through dedicated configuration panels accessed from the same UI, keeping metadata close to the schedule instead of hidden in settings.
- **Accessible and responsive delivery:** large tap targets, keyboard shortcuts for the timeline grid, descriptive CTA labels, and error feedback keep the experience performant on tablets, desktops, and curved screens.

## Core Task Flows
### 1. Draft a Weekly Plan Using Clock-in/Clock-out Segments
1. Pick school + week from the `Week Navigation Banner`; the workspace loads an empty timeline for each day, showing operating hours and existing field trips.
2. Drag staff from the palette onto the timeline, hold to extend a schdule block, or click “Add Clock Block” to set exact HH:MM AM/PM start & end times; the grid supports multiple non-contiguous blocks per day and auto-runs the rules engine, flagging violations instantly.
3. Once the calendar shows all required coverage, the guided tracker on the right re-evaluates the Draft → Validation → Ready states; the publish button shifts from disabled to enabled only when every live violation clears.
Minimum steps: 3 actions (select week → place schdule blocks → confirm tracker turns green).

### 2. Set Daily Metadata: Schedule Type, Enrollment, Field Trip Selection
1. Use the per-day metadata strip above each column to enter the enrolled-child count, choose a schedule type (Regular, Extended, Enrichment, etc.), and pick a field trip type or “No Field Trip.”
2. Each dropdown triggers the rules engine to load ratio requirements and field-trip leader counts; validation badges update instantly, and the field trip card pops up if additional metadata (location, approver, ratio override) is needed.
3. The guided tracker explains which days remain blocked (e.g., “Day missing schedule type” or “Field trip sign-off pending”) and anchors the “Update Ratios” and “Open Field Trip Panel” buttons for quick navigation.
Minimum steps: 3 actions (enter enrollment → pick schedule type → ensure field trip choice and metadata are filled).

### 3. Manage Roster, Certifications, and Ratio Profiles
1. Tap “Settings” → “Roster & Credentials” to add, edit, or remove employees; each entry captures certifications, expiration dates, and leader flags.
2. Use the Ratio + Field Trip manager to create or edit ratio profiles, link them to schedule types, and clean up unused field trip types (the UI warns when a removal would orphan future days).
3. Changes immediately re-run validations; missing certifications turn into violations, and the UI shows which schedule(s) are affected via inline tags (no manual “addressed” toggles).
Minimum steps: 3 actions (open settings → edit roster/ratios → confirm validations re-run automatically).

### 4. Resolve Violations with Live Guidance
1. Select a violation from the Conflict Navigator panel; the grid column flashes, and an inline card reveals the precise policy, severity, and suggested fix.
2. Apply the fix directly (add staff, extend a schdule block, log a break, change enrollment, swap the schedule type, pick a field trip profile) and watch the violation disappear only when the rules engine confirms the change.
3. The tracker moves the workflow onto the next pending step until all active violations are cleared; the “Review ready” badge appears in green alongside audit events that detail who changed what.
Minimum steps: 3 actions (open navigator → implement fix → confirmed auto-validation).

### 5. Publish with Audit and Approval Capture
1. Use the guided tracker summary to confirm all ratios, approvals, and metadata are satisfied; the “Publish Schedule” button remains disabled until the tracker reports everything green.
2. Clicking publish records an `AuditEvent`, exports the week (PDF/CSV), and locks the week from edits until unlocked by an ops lead.
3. Undo/redo controls remain available in case an accidental change slipped through before publishing.
Minimum steps: 3 actions (confirm tracker → click publish → review audit confirmation).

### 6. Enter clock segments with operating-hours guardrails
1. The workspace paints each day with the linked `OperatingHours` window (open/close times and `OperatingHoursId`), so users always see the allowable range before adding a block.
2. Tap “Add Clock Block” or drag a staff tile onto the timeline, then use the time picker to choose any HH:MM AM/PM pair inside that window; the timeline allows adding multiple non-contiguous `SegmentBlock`s for the same staff or day, and each block flags if the rules engine detects an operating-hours violation.
3. The guided tracker and Conflict Navigator immediately surface ratio violations, certification gaps, or coverage shortfalls tied to those blocks; there is no “mark addressed” control—violations clear only when a new block or metadata change satisfies the rules engine, so the workspace stays truthful to the live data.
Minimum steps: 3 actions (view operating hours → create block(s) → confirm tracker/Conflict Navigator shows no blockers).

## UI Flow Map
| Task | Entry Point | Key Screens / Actions | Outcome | Minimal Steps | Notes |
| --- | --- | --- | --- | --- | --- |
| Draft week with clock-based coverage | Week navigation banner → “New schedule” | Timeline grid → drag staff → watch violations highlight | Completed week draft with live ratio status | 3 | Supports multiple non-contiguous blocks per day |
| Configure daily metadata | Per-day metadata strip | Enter enrollment → pick schedule type → assign field trip type | Metadata synced with ratio engine | 3 | Field trip picker enforces a profile or “No Field Trip” |
| Manage staff, certifications, ratios, field trips | Settings menu (Roster & Ratios) | Add/edit staff → attach certs → maintain ratio/field trip profiles | Live validation of credentials + ratio availability | 3 | Warns before deleting profiles referenced by future days |
| Resolve violations | Conflict navigator or violation pins | Select violation → focus segment → apply fix | Auto-cleared violation | 3 | Violations cannot be manually marked addressed |
| Publish schedule | Guided tracker | Review summary → confirm audit events → Publish | Schedule locked and exported | 3 | Undo/redo and audit timeline stay visible |

## Wireframes
### Weekly Schedule Workspace
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Week navigation                                                  [Status] [Help] │
│ School [dropdown]   Week [range selector]   Status: Draft → Validation → Ready │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│ Staff palette │ Timeline grid (each column = day, rows = hourly timeline)        │
│ - Filter controls (cert, availability)                                           │
│ - Quick buttons (Add schdule block, Auto-fill ratios)                              │
├───────────────┼─────────────────────────────────────────────────────────────────────┤
│               │ Day metadata strip: [Enrollment input] [Schedule type v] [Field Trip v] │
│               │ Timeline axis: 6:00a → 6:00p (adjustable)                              │
│               │ Schedule blocks show staff chip, certifications, ratio badges, breaks     │
│               │ Violation pins stack in top-right corner of each block               │
│               │ Drag handles extend start/end times, double-click opens exact editor │
├───────────────┴─────────────────────────────────────────────────────────────────────┤
│ Guided tracker (Compliance steps + next action)   | Conflict navigator | Audit/Undo |
│ [Pending: Day needs schedule type]                 | [Violation list]    | [Undo/Redo]|
└───────────────────────────────────────────────────────────────────────────────┘
```
- Timeline grid is clock-based, so users place staff anywhere within operating hours; multiple blocks stack vertically for non-contiguous shifts.
- Day metadata strip sits above each column, showing current enrollment, schedule type, and mandatory field trip status; each change triggers ratio recalculation.
- Violation pins surface policy citations and stay until the rules engine confirms the fix.
- Guided tracker, conflict navigator, and audit/undo controls stay visible to keep compliance top of mind while editing.

### Daily Metadata & Field Trip Strip
```
┌───────────────────────────────────────────────────────────────┐
│ Day metadata strip                                            │
│ [Enrollment 32]   [Schedule type: Extended ▼]   [Field trip: Museum Visit ▼] │
│ - Hover tooltip: “Extended day raises ratio from 1:8 → 1:6”     │
│ - Field trip menu enforces selection: badge shows ratio override │
│ - “No Field Trip” option unlocks ratio defaults                 │
│ - Missing data shows a red badge; tracker blocks publish        │
└───────────────────────────────────────────────────────────────┘
```
- Each dropdown lists schedule types defined in settings and their ratio targets; selecting a new type revalidates the grid automatically.
- Enrollment entry updates the ratio calculator and triggers revalidation, so staffing needs adjust immediately.
- Field trip panel opens from this strip to capture approver, location, and signature; until metadata is complete, the strip stays red and the tracker displays “Field trip sign-off required.”

### Settings Panel: Staff, Certifications, and Ratios
```
┌───────────────────────────────────────────────────────────────┐
│ Settings tabs: [Roster & Certifications] [Ratio & Field Trips] │
├───────────────────────────────────────────────────────────────┤
│ Roster table                                                  │
│ - Staff name | Role | Certifications | Weekly hours | Leader flag │
│ - Inline buttons: Add cert, Set expiration, Remove staff       │
├───────────────────────────────────────────────────────────────┤
│ Ratio/Field Trip manager                                       │
│ - Profile list with child:adult target, field trip overrides   │
│ - Actions: Add field trip type, Clone ratio, Delete (warns)     │
│ - Status chips: “In use by March 9–13”                         │
└───────────────────────────────────────────────────────────────┘
```
- Adding or editing certifications triggers immediate validation messages on the workspace (e.g., “Violation: CPR expired for Julie—shift needs reassigning”).
- Ratio manager lets users tie each profile to schedule types or field trips and prevents deleting any profile that still has active references.
- Settings panel stays contextual: opening it overlays the workspace but keeps the guided tracker visible so users know which violations remain after adjusting metadata.

## Component Specs
- **WeekNavigationBanner**
  - Purpose: choose school/week, show status, launch exports.
  - Inputs: selected school/week, compliance step, next action hint.
  - Interactions: open school picker, set week, quick jump to next week.

- **DayMetadataStrip**
  - Purpose: capture enrollment headcount, per-day schedule type, and required field trip type.
  - Inputs: enrollment number, schedule type list, field trip type list, validation state.
  - Interactions: inline editing of enrollment, dropdown selection, open field trip panel, show ratio hint tooltip.

- **ClockBlockTimeline (Schedule Grid)**
  - Purpose: allow staff to be placed into precise clock segments and show coverage per day.
  - Inputs: schdule block data, operating hours, violation badges, ratio badges, assigned staff metadata.
  - Interactions: drag/drop to assign, stretch handles to resize, double-click for precise HH:MM edit, split blocks for non-contiguous coverage.

- **StaffPalette**
  - Purpose: list staff ready for assignment, highlight certifications, and quick filters.
  - Inputs: staff availability, leader/CPR flags, weekly hours, current assignments.
  - Interactions: drag onto timeline, tap for staff detail drawer, use filters (cert, role, capacity).

- **FieldTripApprovalPanel**
  - Purpose: capture metadata (approver, signature time, location) that unlocks field trip ratios.
  - Inputs: selected field trip type, ratio override, required approver fields.
  - Interactions: fill approver + timestamp, show lock state until complete, surface ratio differences per type, warn if deleting referenced type.

- **ConflictNavigator**
  - Purpose: list live violations tied to schdule blocks or metadata and direct users to fixes.
  - Inputs: violation payloads, severity, linked day/times, suggested action.
  - Interactions: click to focus grid blocks, show policy cite tooltip, auto-highlight affected staff.

- **GuidedStatusTracker**
  - Purpose: show workflow steps (Draft → Validation → Ready) and gate publish until all violations clear.
  - Inputs: aggregated validation state, blocked metadata (missing schedule type/field trip/approver), audit events.
  - Interactions: tap to expand step details, open help tip, jump to missing metadata area, keep publish button disabled until green.

- **SettingsDrawer (Roster & Ratios)**
  - Purpose: CRUD staff, certifications, ratio profiles, and field trip types.
  - Inputs: staff list, certifications, ratio constraints, field trip metadata.
  - Interactions: add/remove staff, set credential expiration, reassign field trip types, warn when deleting profiles still referenced by scheduled days.

- **AuditTimeline & UndoBar**
  - Purpose: surface recent edits, show who changed what, and allow safe undo/redo.
  - Inputs: `AuditEvent` entries, validation state snapshots.
  - Interactions: click event to view diff, undo/redo changes, export audit log snippet.

- **Toast & Inline Tips**
  - Purpose: reassure users after each critical action (e.g., “Enrollment updated; ratios recalculated”) and provide policy context without leaving the page.
  - Inputs: action types, rule citations, next required action.
  - Interactions: auto dismiss after a few seconds, accessible via “Responses” tab for reference.

## Next Steps for Frontend Engineering Agent
1. Translate this blueprint into layout prototypes for `DayMetadataStrip`, `ClockBlockTimeline`, and `GuidedStatusTracker`, ensuring per-day dropdowns trigger recalculations instantly.
2. Build settings overlays that let coordinators manage staff/certs, ratio profiles, and field trip types in the same workflow, with warnings when deletions would leave future days unassigned.
3. Verify the Conflict Navigator, field trip approval panel, and guided tracker all draw from the same validation stream so no violation can ever be marked addressed manually; the rules engine should clear them only after the underlying data changes.
