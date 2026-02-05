# Scheduling Workspace Onboarding Guide

## Who should read this
Site directors, scheduling coordinators, and substitute coordinators who need to staff the district daycare without relying on live training. The goal is to walk through the guided workflow—staff setup, schedule building, approvals, and publication—using the UI components that enforce policy compliance.

## Workspace overview
- **Configuration panel** (top-right gear): add/remove employees, update certifications, edit availability windows, and manage ratio/certification requirements. Every change flows instantly into the validation engine.
- **Schedule Grid** (center): shows the week’s segments. Drag staff, log clock-in/out times, and add multiple work blocks per day by dropping the same person into separate segments.
- **Staff Palette** (right rail): lists eligible employees with their job titles, certifications, and auto-select recommendations. Cards highlight leaders/certified staff to help you meet ratio and qualification rules.
- **Guided Status Tracker** (left rail): walks you through Prepare → Assign → Review → Publish. Each step exposes the current blockers; you cannot advance until the underlying rules are satisfied.
- **Violation Navigator** (bottom tray): surfaces outstanding policy violations along with the policy citation. Click an item to highlight the affected segment or certification.
- **Field Trip & Substitute panels**: appear when a block is flagged as a field trip or when a substitute request is pending. Use the panels to sign off approvals, check parity, and trigger re-validation.

## Step 1: Prepare staff & configurations
1. Open the configuration panel and select “People & Certs.”
2. For each employee, add the contact info, job title, employment status, and max hours per day/week. You can track multiple certifications (`cpr`, `first_aid`, `medical_delegation`, etc.) with issued/expiry dates so the rules engine knows when coverage lapses.
3. Use the same panel to define **ratio profiles** (`children_per_staff`, `leader_required`, `policy citation`) for each day segment (`open`, `mid`, `close`). Field trip types live here too—specify their adult/leader ratios and attach the relevant policy citation so off-site blocks inherit the correct guardrails.
4. Save changes. The workspace immediately recalculates violations and updates the Guided Status Tracker; nothing is marked “addressed” manually—validation entries disappear only when the data meets the rule.

## Step 2: Build the weekly schedule
1. In the Schedule Grid, select the target week. If you already have a template, copy it forward from a prior week to preserve segment blocks and child counts.
2. For each day and segment, set the child count or import from the roster. The grid uses the count plus the ratio profiles to compute how many staff are required.
3. Add multiple non-contiguous blocks for a staff member by dropping them into different segments on the same day. The app allows separate start/end times for each block, so the schedule reflects split shifts.
4. Click any assignment to log clock-in and clock-out times (per-block). This timing data feeds the rules engine to verify `max_hours_per_day`, break spacing, and overtime constraints.
5. Once blocks are seeded, the violation tracker immediately flags coverage gaps or missing certifications. The Plan step in the status tracker will remain blocked until those are resolved.

## Step 3: Assign staff & handle special cases
- **Auto-select helper.** Use the “Auto-select” action from the Staff Palette to let the system choose the best-fit staff for a highlighted block; it considers leader requirements, certifications, and availability.
- **Substitutes.** When a shift needs a substitute, raise a request (plus reason), pick a qualified candidate, and submit it. The substitute approval must meet parity rules (certification, hours) before the block is validated. The Substitute panel updates the violation list so the Review step doesn’t clear until parity holds.
- **Field trips.** Mark a segment as a field trip event, choose the related `FieldTripType`, and sign off in the Field Trip panel. Approvals change the ratio/leader requirements for that block and may trigger new violations until the new ratios are satisfied.
- **Multiple blocks & breaks.** Insert `ShiftBreak` entries between blocks when staff need rest or meal time. The rules engine checks for mandated breaks, so you can see gap warnings right next to the block.

## Step 4: Review validations & guided steps
1. Open the Violation Navigator (bottom tray) to review outstanding findings. Each entry links back to the grid or a certification record and shows the policy citation.
2. Resolve issues by editing schedule data—not by toggling a manual “addressed” flag. Once you meet the rule (e.g., add a certified leader, drop the substitute, adjust child count), the violation disappears.
3. The Guided Status Tracker updates the Review and Publish steps automatically. You can only publish when zero unresolved violations remain and all approvals (field trips, substitutes) are signed off.
4. Use the Status Tracker to confirm which blockers remain (clock icons show clock-in/out gaps; badge icons show unmet ratio requirements).

## Step 5: Publish & export
1. When the Publish step turns green, click “Publish schedule.” This action records an audit entry (`submitted_by`, `submitted_at`) and marks the `ScheduleWeek` status as `ready_for_review` or `submitted`.
2. Export copies for your records via the PDF/CSV buttons in the grid toolbar. Each export includes the audit trail, compliance citations, and headcounts for print/outside auditors.
3. If you need to update the week later, open it (status will typically show `draft` or `ready_for_review`), make changes, and rerun the validations.

## Sample schedule walkthrough
![Sample weekly schedule workflow, showing staff assignments, violations, and ratios.](Example Schedule Spreadsheet.png)

- The screenshot above mirrors the Schedule Grid layout. Use it to identify the child counts, assigned staff, violations, and status tracker widgets before you work in the real UI.

## Quick checks before publishing
- Confirm every staff card in the palette shows the certifications required by the block (CPR, medical delegation, etc.).
- Verify that the status tracker has advanced through Plan → Assign → Review → Publish and that no step shows a red blocker badge.
- Use the Violation Navigator to confirm zero unresolved issues. If an entry persists, click it to jump to the offending block and resolve the underlying data.
- Ensure field trips show “signed off” in the Field Trip panel and substitute requests show `approved` before hitting Publish.
- Export a PDF for your audit folder so you can prove what you published and which citations were satisfied.

## Need a refresher?
Refer to `docs/testing-approach.md` for the latest QA rules, guardrail tests (QA-RULE-017 through QA-RULE-021), and automation checkpoints that mirror these UI flows. Keeping the docs aligned means every new schedule can be reproduced and validated without extra training.
