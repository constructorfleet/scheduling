# Scheduling Workspace User Guide

## Who should use this guide
Site directors, scheduling coordinators, and substitute coordinators who must staff daycare classrooms without relying on live training. This guide walks through the workspace in the same order a user will experience it—setup, schedule building, validations, and publishing—with screenshots and practical reminders so each task can be completed independently.

## Overview of the workspace
- **Configuration panel (gear icon, top-right)**: add or remove employees, maintain certifications, and keep ratio requirements current. Every edit immediately feeds the validation engine, so no finding can be marked “addressed” manually; the violation disappears the instant the rule is satisfied.
- **Schedule Grid (calendar center)**: shows the selected week with segments, child counts, and staff assignments. Drag staff cards from the palette, drop them on segments, and log clock-in/clock-out times per block.
- **Staff Palette (right rail)**: displays each employee’s job title, certifications, availability windows, and recommended assignments. The palette highlights certified leaders to help you meet leader/child ratios.
- **Guided Status Tracker (left rail)**: enforces the Prepare → Assign → Review → Publish flow. Every step lists blockers; you cannot publish until all violations are cleared.
- **Violation Navigator (bottom tray)**: lists unresolved policy violations with citations. Selecting one highlights the affected block or certification so you can fix the underlying data.

![Scheduling grid with staff assignments, violations, and guided tracker highlighted.](Example Schedule Spreadsheet.png)

## Step 1: Configure employees, certifications, and ratios
1. Open the gear icon and choose **People & Certifications**.
2. Add or edit employees so each record includes:
   - Job title, contact info, employment status, and hourly caps (`max_hours_per_day`, `max_hours_per_week`).
   - Certifications (CPR, First Aid, Medical Delegation, etc.) with issue and expiration dates so the compliance engine can tell when a qualification lapses.
   - Availability windows so the auto-select helper respects person-specific hours.
3. Switch to the **Ratio Requirements** tab in the same panel to add, edit, or remove profiles (`children_per_staff`, `leader_required`, `policy citation`) for in-house segments and field-trip types. Store the citation text here so violations show the district rule that applies.
4. Save. Configuration changes rerun validations immediately; the violation list and guided tracker update when the new data satisfies the corresponding rule.

## Step 2: Seed the week and enter clock tools
1. Choose the target week in the Schedule Grid. You can copy a prior week if you already have a template, or start fresh by entering child counts per day/segment (typed or imported from the roster).
2. Drag staff from the palette into each segment. You can add multiple non-contiguous blocks for the same employee on one day by dropping them into different segments and adjusting the block’s start/end times separately. This mirrors split shifts, travel days, and staggered coverage.
3. Click a block to open the time entry dialog and log **clock-in / clock-out times** as any `HH:MM AM/PM` value within the operating hours. These times drive overtime, break, and compliance checks—make sure they reflect the actual shift boundaries.
4. If you need extra staffing help, use the **Auto-select** button. It looks at leader requirements, certifications, and availability windows before suggesting the best fit.
5. Mark field trips from the block’s settings: select the `Field Trip Type`, complete the approval, and confirm the adjusted ratio targets display below the block.

## Step 3: Resolve validations and guided steps
- Open the **Violation Navigator** and click each issue to highlight the affected block or certification record. Each violation lists the policy citation and tells you what data needs to change (e.g., add a certified leader, drop the substitute, alter child count).
- Modify schedule data instead of toggling a manual “addressed” flag; violations auto-clear the moment the rule is satisfied.
- The **Guided Status Tracker** mirrors the same data. Only when violations are zero does the Review step allow you to move forward, and the Publish step remains blocked until approvals (field trips, substitutes) are signed off.
- Use the **Status Tracker icons** (clock icon for missing clock entries, badge for unmet ratios, shield for certification gaps) to triage quickly.

## Step 4: Publish and stay audit-ready
1. When no violations remain and the Publish step turns green, click **Publish schedule**. The system records who submitted the week and when, and sets the week’s status to `ready_for_review` or `submitted`.
2. Export the week (PDF/CSV toolbar buttons) for district records. The exports include every citation, violation snapshot, and the audit trail so you can prove compliance during reviews.
3. If you reopen a published week, validation reruns automatically. Make edits, confirm the violation list shrinks to zero, and republish once approvals stay green.

## Quick reference reminders
| Task | Notes | Where to find it |
| --- | --- | --- |
| Add/remove employees | Use the configuration gear → People & Certifications; updates run validations instantly. | Gear icon → People & Certifications |
| Update ratio/cert rules | Configure `children_per_staff`, leaders required, and citations for segments and field trips. | Gear icon → Ratio Requirements |
| Log clock-in/out times | Enter any `HH:MM AM/PM` within the operating hours. These times feed overtime/break rules. | Click block → Time entry |
| Create multi-block days | Drop the same staff onto multiple segments; each supports its own start/end time. | Schedule Grid block editor |
| Track violations | Violation Navigator bottom tray plus guided steps auto-block until resolved. | Violation tray + Status tracker |
| Export for audits | PDFs/CSVs include ratios, violations, and audit trail. | Schedule Grid toolbar |

## Need a refresher?
If you want to revisit the QA guardrails (QA-RULE-017 through QA-RULE-021, and the new timeline integrity catalog), open `docs/testing-approach.md` for the compliance matrix, automation plan, and the blockers you can expect while running the suites. Keep this guide handy so every schedule stays compliant even without a trainer.
