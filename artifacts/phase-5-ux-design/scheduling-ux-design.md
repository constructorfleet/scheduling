# Scheduling UX Blueprint

## Purpose and Design Principles
- **Guided clarity for non-technical users:** each screen speaks in plain language, surfaces inline tips, and highlights the next required action so a director can move from draft to review without training.
- **Minimal steps per task:** 3–4 well-labeled taps/drags deliver every capability (create a week, assign staff, resolve conflicts, approve field trips/substitutes, publish) so workflows remain short and predictable.
- **Compliance focus:** violations, policy citations, and missing metadata appear beside the workspace, meaning compliance awareness never requires digging through menus.
- **Responsive, accessible layout:** large typography, clear contrast, and persistent tooltips/ARIA labels keep the experience usable for the busy scheduling coordinator.

## Core Task Flows
### 1. Start a Weekly Schedule (Draft)
1. Select the school and week from the top-left banner (school dropdown, week picker, quick status badge).
2. “Start new schedule” creates a blank grid with the chosen week preloaded; the guided status tracker opens on the right to describe the next required compliance checks.
3. The workspace auto-saves each change and shows the active step (Draft → Validation → Ready for Sign-off).

### 2. Assign Staff Across Segments
1. Drag a staff card from the left palette onto a time-segment cell (grid defaults to morning/afternoon blocks with ratio hints).
2. The cell instantly shows assigned certifications and whether CPR/leader requirements are satisfied; a tooltip calls out coverage gaps (e.g., “Leader needed for 9a–12p, only Assistant assigned”).
3. Release the card; the rules engine runs live and marks any violation with a pinned flag linked to that block.
4. Optional: use the “Auto-balance” control to suggest next staff for uncovered segments, keeping total weekly hours and break rules visible in the right-hand metrics.

### 3. Resolve Conflicts and Violations
1. Click a violation from the conflict navigator; the affected grid cells highlight and the violation card expands with policy citations, required action, and proposed fix (e.g., “Add a certified Leader or extend Assistant shift”).
2. Make the necessary edits (add staff, adjust hours, log a break) directly in the grid or via the inline action buttons on the violation card.
3. Once every violation is marked resolved, the tracker shows a green “Review ready” state and unlocks the “Request Review” button.

### 4. Manage Field Trips and Substitute Coverage
1. Open the Field Trip card in the week’s timeline; it overlays a panel listing the field trip type, ratio override, and required metadata (location, children count, director sign-off).
2. Fill in approver name and timestamp; until both are filled the panel remains in a “Sign-off required” state and prevents the week from reaching “Ready for Sign-off.”
3. Substitute assignments surface via a dedicated tab in the palette with filters for approved requests; dropping a substitute onto a block forces a metadata check (approver, parity qualifications) before the assignment takes effect and logs a violation if metadata is missing.

### 5. Review, Audit, and Publish
1. The guided tracker summarizes outstanding requirements (ratio checks, break history, approvals) and displays audit events below (who changed what and when).
2. Undo/Redo controls sit beside the tracker so directors can back out accidental edits without leaving the workspace.
3. When all validation steps are green, the “Publish Schedule” button enables, capturing an `AuditEvent`, exporting the week, and recording the completion timestamp.

## UI Flow Map
| Task | Entry Point | Key Screens/Actions | Outcome | Minimal Steps | Notes |
| --- | --- | --- | --- | --- | --- |
| Create + Draft Weekly Schedule | Home dashboard “New Schedule” card | Week picker → Workspace loads → Guided tracker opens | New week in Draft | 3 steps | Persistent status badge clarifies Draft ⇒ Review stages |
| Assign Staff and Handle Breaks | Schedule workspace grid | Palette drag → Grid shows coverage → Rules panel update | Block covered or violation flagged | 3 steps | Inline hints highlight ratio/leader needs |
| Resolve Violations | Conflict navigator badge | Violation card → click to focus block → Accept fix | Violation resolved | 3 steps | Policy citations and actionable guidance visible; each card links to block |
| Field Trip + Substitute Approvals | Field trip preview in week timeline / substitute tab | Panel opens → Fill metadata → Confirm | Approved event and preserved parity | 3 steps | Blocks reaching ready state only after metadata complete |
| Publish & Audit | Guided tracker | Review summary → Audit events → Publish button | Schedule marked Ready | 3 steps | Undo/Redo and export hints remain available |

## Wireframes
### Weekly Schedule Workspace
```
+---------------------------------------------------------------------------------+
| [School dropdown v]   Week: [Mar 2–8]  Status: Draft   ← →   [Guided status tracker]|
+---------------------+-----------------------------------------------------------+
| Staff palette        |             Schedule grid (segments by day/time)             | History & help |
| - Filters (certs,    |  Columns: Sun–Sat                                           | - Audit timeline |
|   availability)      |  Rows: Morning, Midday, Afternoon, Field Trip rows           | - Tip bubble for policy citations |
| - Favorite staff     |  Cells show: staff chips + certifications + ratio badges    | - Undo/Redo, Export buttons |
+---------------------+-----------------------------------------------------------+
| Primary actions bar: [Add Template] [Copy from last week] [Run validation] [Publish] |
+---------------------------------------------------------------------------------+
```
- Staff cards show certifications icons, hours this week, and small leader/CPR flags.
- Grid cells color-code compliance (green/amber/red) and stack small badges for ratios/breaks.
- Violation pins appear immediately on the top-right of each cell; hover reveals citation.
- Help bubble explains the successive workflow steps (Draft → Validation → Review). The pinned tracker always shows the next required action (e.g., “Add a Leader” or “Field trip sign-off missing”).

### Conflict Navigator Panel
```
+-------------------+
| Violation list    |
| [Sort: Severity]  |
| - “Ratio breached 9–12” → policy cite + actions   |
| - “Break missing for Julie” → action button       |
+-------------------+
| Selected violation |
| Grid preview + policy citation + fix suggestions |
| [Resolve by adding staff] [Mark resolved after manual fix] |
| > Focused grid block flashes matching colors        |
+-------------------+
```
- Clicking a violation auto-focuses the grid block; the navigator includes a quick “Jump to block” button and adds context (child count, required ratio, missing cert).
- Each violation card contains direct call-to-action buttons (“Add Leader,” “Log Break,” “Open Field Trip approval”).

### Field Trip & Substitute Panels
```
+---------------------------+    +-------------------------------+
| Field Trip Approval       |    | Substitute Assignments tab    |
| - Field trip type badge   |    | - Filter by approved requests  |
| - Ratio override summary  |    | - Cards show required certs    |
| - Children signed off     |    | - Metadata checklist per card  |
| [Add approver] [Add time] |    | [Assign substitute] [Reject]   |
| Status chip (locked until fields filled) |    |  Status: Parity check, violation info |
+---------------------------+    +-------------------------------+
```
- Field trip panel remains red/locked until both `approver_id` and `signed_off_at` are captured; hovering shows reminder text referencing policy.
- Substitutes panel auto-checks certification parity and highlights missing approver metadata; blocking badge prevents assignment until metadata is complete.

## Component Specs
- **WeekNavigationBanner**
  - Purpose: surface school + week selection, publication status, and quick hints.
  - States: Draft, Validation in progress, Review requested, Ready to publish.
  - Inputs: selected school, week range, compliance status, upcoming approvals.
  - Key interactions: open school picker, fast-forward to next week, view help tooltip for workflow step.

- **StaffPalette**
  - Purpose: list staff by availability/certification; allow drag into grid.
  - States: Available, On break, Already assigned (greyed), Substitute-only.
  - Inputs: staff metadata (certifications, roster status, assigned hours, leader flag).
  - Interactions: drag to grid cell, click to open staff info drawer, filter by cert/break.

- **ScheduleGrid & SegmentBlock**
  - Purpose: show day/time segments, assignments, and inline compliance hints.
  - States: Empty, Covered (compliant), Warning (on the edge), Violation.
  - Inputs: `SegmentBlock` data (child count, ratio requirement, assigned staff list, breaks logged).
  - Interactions: drop staff, click to open segment detail modal, double-check break or shift logs.

- **ViolationNavigator**
  - Purpose: list and explain live rule violations with direct actions.
  - States: Active violations, Resolved, Needs manual confirmation (for overrides).
  - Inputs: rule violation payload (policy citation, severity, suggested fix, linked block).
  - Interactions: click to focus block, “Mark resolved” once issue handled outside UI, navigate to field trip/substitute panel.

- **GuidedStatusTracker**
  - Purpose: keep awareness of workflow progression (Draft, Validation, Sign-off, Publish).
  - States: Step pending, Step in progress, Step complete, Blocked (needs field trip sign-off, missing break, etc.).
  - Inputs: aggregated validation results, missing metadata, approval stamps.
  - Interactions: tap to see details for a blocked step, open help tip, access audit trail.

- **FieldTripApprovalPanel**
  - Purpose: capture metadata required for field trips, highlight overrides, and gate publish.
  - States: Locked (missing approver/timestamp), Ready for sign-off, Approved.
  - Inputs: field trip type, ratio overrides, approver info, child count.
  - Interactions: fill approver/save, add director signature timestamp, jump back to grid cell on icon click.

- **SubstituteAssignmentPanel**
  - Purpose: ensure substitute parity and approved request metadata before allowing assignments.
  - States: Action required (missing approver), Ready (metadata present), Violation (parity missing).
  - Inputs: substitute request, certification list, requested approver.
  - Interactions: assign to cell (automated parity check), open request detail, log missing metadata.

- **AuditTimeline & UndoBar**
  - Purpose: show recent audit events and provide undo/redo controls.
  - States: default, showing new event, disabled (nothing to undo).
  - Inputs: list of `AuditEvent` entries (user, timestamp, description, policy cite).
  - Interactions: click entry to view diff, use undo/redo buttons, export audit log snippet.

### Accessibility & Non-Technical Helpers
- Toast guidance after every critical step (“Break recorded; ratio satisfied for 12p–3p”) plus inline tooltips referencing policy plain-language summaries.
- Keyboard-friendly navigation in the grid (arrows jump cells, space assigns highlight staff), so users on laptops reach tasks without a mouse.
- Persistent help icon opens a short guided tour for each screen, but the most critical instructions appear as inline hints so even first-time users complete tasks in <5 minutes.

## Next Steps for Frontend Engineering Agent
1. Use this blueprint to prototype the `ScheduleGrid`, `ViolationNavigator`, and `GuidedStatusTracker` components, wiring them to the rules engine outputs.
2. Build the Field Trip and Substitute panels as gated overlays that block the final publish step until required metadata is present.
3. Validate the undo/redo and audit timeline interactions with unit/integration tests to prove the workspace is error-resistant.

All designs keep the DOD in mind: key tasks complete in 3–4 actions, compliance insights show alongside the workspace, and no specialized training is needed thanks to guided statuses, inline tips, and accessible controls.
