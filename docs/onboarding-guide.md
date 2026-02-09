# Scheduling Workspace Onboarding Guide

## Who should read this
Site directors, scheduling coordinators, and substitute coordinators who need to staff the district daycare without relying on live training. The goal is to walk through the guided workflow—staff setup, schedule building, approvals, and publication—using the UI components that enforce policy compliance.

## Workspace overview
- **Configuration panel** (top-right gear): add/remove employees, update certifications, edit availability windows, and manage ratio/certification requirements. Every change flows instantly into the validation engine.
- **Schedule Grid** (center): shows the week’s segments. Add staff blocks, log clock-in/out times, and create multiple work blocks per day by adding separate blocks on the same day.
- **Guided Status Tracker** (left rail): walks you through Prepare → Assign → Review → Publish. Each step exposes the current blockers; you cannot advance until the underlying rules are satisfied.
- **Violation Navigator** (bottom tray): surfaces outstanding policy violations along with the policy citation. Click an item to highlight the affected segment or certification.
- **Audit Log** (top banner): review recent changes and use Undo/Redo to step through edits.

## Step 1: Prepare staff & configurations
1. Open the configuration panel and select “People & Certs.”
2. For each employee, add the job title, employment status, and max hours per day/week. Toggle CPR current and medical delegation flags so the rules engine can validate certifications.
3. Use the same panel to define **schedule types** and **field trip types** with their ratios and policy citations. Configure operating hours and the field trip ratio window in the School tab.
4. Save changes. The workspace immediately recalculates violations and updates the Guided Status Tracker; nothing is marked “addressed” manually—validation entries disappear only when the data meets the rule.

## Step 2: Build the weekly schedule
1. In the Schedule Grid, select the target week. If you already have a template, copy it forward from a prior week to preserve segment blocks and child counts.
2. For each day and segment, set the child count or import from the roster. The grid uses the count plus the ratio profiles to compute how many staff are required.
3. Add multiple non-contiguous blocks for a staff member by dropping them into different segments on the same day. The app allows separate start/end times for each block, so the schedule reflects split shifts.
4. Click any assignment to log clock-in and clock-out times (per-block). This timing data feeds the rules engine to verify `max_hours_per_day`, break spacing, and overtime constraints.
5. Once blocks are seeded, the violation tracker immediately flags coverage gaps or missing certifications. The Plan step in the status tracker will remain blocked until those are resolved.

## Step 3: Assign staff & handle special cases
- **Auto Schedule.** Use the “Auto” action in the banner to seed staffing based on ratios, certifications, and availability.
- **Field trips.** Select a field trip type in the day metadata. Field trip ratios apply during the configured field trip window and may trigger new violations until staffing meets the requirement.
- **Multiple blocks.** Add separate blocks to represent split shifts and non-contiguous coverage on the same day.

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
