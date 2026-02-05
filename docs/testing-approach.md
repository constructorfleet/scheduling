# Testing Approach for the Scheduling Application

## Compliance-first test pillars
Every automated tier traces back to a documented rule so that ratios, certifications, coverage, shift limits, substitutes, and field trips stay accountable to the district policy catalog. The **Rules Engine Test Plan** describes how each obligation requires both a violation and a clean scenario before a week moves beyond draft, and it links those scenarios to the matching policy references in `RULES_TEST_CASES.md:1-95`. Those expectations drive every suite described below and keep the compliance story auditable for QA and district reviewers (`artifacts/phase-4-testing/rules-test-plan.md:1-54`).

## Rules test plan & matrix
The plan enumerates each rule, the critical scenario that must trigger a violation, and the happy-path outcome that must stay violation-free, and it cites the exact Jest fixture files that capture the assertions. Beyond providing direction to engineers, the matrix gives QA reviewers a single source of truth for how the violations map back to the policy catalog entries (`artifacts/phase-4-testing/rules-test-plan.md:8-54`).

### Key rule scenarios
- **ratio-segment:** Blocks must never submit with fewer staff than `max(minStaff, ceil(childCount / ratio.childrenPerStaff))`, so the ratio violation tests intentionally under-assign and the clean tests include the enforced minimum (`artifacts/phase-4-testing/rules-test-plan.md:10-14`).
- **certification-per-segment:** Every required flag (CPR, medical delegation, leader) gets an explicit violation when missing, and clean fixtures prove that a fully certified assignment clears the rule (`artifacts/phase-4-testing/rules-test-plan.md:15-19`).
- **segment-coverage:** Checks for leader and medical coverage guardrails so both failure modes and success scenarios appear in the plan (`artifacts/phase-4-testing/rules-test-plan.md:20-24`).
- **shift-break-limits:** Daily and weekly cap breaches are exercised via back-to-back assignments while the happy path proves short blocks stay under both caps (`artifacts/phase-4-testing/rules-test-plan.md:25-28`).
- **substitute-parity:** Tests confirm that missing approvals, metadata, or parity fields each surface violations, and that approved requests with approver/timestamp metadata pass (`artifacts/phase-4-testing/rules-test-plan.md:30-33`).
- **field-trip-ratios:** Adult and leader counts are validated against `FieldTripType` minima so both shortage and compliant combinations are recorded (`artifacts/phase-4-testing/rules-test-plan.md:35-38`).
- **field-trip-signoff:** The plan enforces that missing `approverId` or `signedOffAt` fields produce violations while full sign-offs clear (“happy path”) (`artifacts/phase-4-testing/rules-test-plan.md:40-44`).

### Additional guardrails
- **Field-trip overrides own ratios:** `ratio-segment` stops evaluating blocks that are tied to signed-off field trips, ensuring `field-trip-ratios` is the single source of truth for those overrides (`QA-RULE-017` / `tests/rules/rulesEngine.test.ts`).
- **Weekly cap detection spans days:** Weekly violations trigger even when each individual day stays within its cap so cumulative coverage is enforced (`QA-RULE-018` / `tests/rules/rulesEngine.test.ts`).
- **Substitute parity enumerates missing approval metadata:** Partial approvals surface a violation whose `missing` array lists every absent field, making it easy to resolve incomplete substitute requests (`QA-RULE-019` / `tests/rules/rulesEngine.test.ts`).
- **Field trips distinguish adults from leaders:** Even when adult staffing meets the ratio, leader shortages still yield violations so leadership coverage can't be bypassed (`QA-RULE-020` / `tests/rules/rulesEngine.test.ts`).
- **Sign-off metadata is granular:** Missing only `approverId` still produces an actionable `field-trip-signoff` violation, keeping the approval status explicit (`QA-RULE-021` / `tests/rules/rulesEngine.test.ts`).

## Rule engine suites (Jest)
The `RulesEngine` (`src/rules/engine.ts:4`) evaluates `DEFAULT_RULE_DEFINITIONS` (`src/rules/definitions.ts:407`) so every execution path shares the same curated catalog. Each definition—ratios, certifications, coverage, shift limits, substitutes, and field-trip requirements—uses helpers for violation metadata and policy citations before emitting `RuleViolation` objects. The Jest harness, configured via `jest.config.ts:3-10`, runs under the `ts-jest` preset and uses `tests/setupTests.ts:1` as a future hook for shared matchers or spies.

The canonical tests at `tests/rules/rulesEngine.test.ts:83-474` pair violation and clean fixtures for every critical rule:
- Ratio violation vs. clean sections (`tests/rules/rulesEngine.test.ts:83-211`).
- Certification shortfalls vs. satisfied certification sets (`tests/rules/rulesEngine.test.ts:132-211`).
- Coverage and leader gaps vs. complete coverage assignments (`tests/rules/rulesEngine.test.ts:187-211`).
- Shift/day-week cap breaches vs. compliant time spans (`tests/rules/rulesEngine.test.ts:238-265`).
- Substitute metadata missing vs. approved requests (`tests/rules/rulesEngine.test.ts:290-311`).
- Field-trip ratios vs. compliant adult/leader pools (`tests/rules/rulesEngine.test.ts:344-384`).
- Field-trip sign-off missing data vs. signed-off events (`tests/rules/rulesEngine.test.ts:429-452`).

## Integration & UI automation (Playwright + UX)
Playwright is prepared for future scenario-based flows via `npm run test:e2e` (`package.json:14`). When the scheduling workspace and conflict navigator reach implementation, `tests/e2e/` and `tests/ui/` can host Page objects, fixtures, and walkthroughs that prove rules surface before persistence and that the guided UI keeps directors on the compliant path.

## Running the suites
- `npm test` (`package.json:16`) runs Jest with the roots defined in `jest.config.ts:6`, so rule-engine suites execute with every developer iteration.
- `npm test -- tests/rules/rulesEngine.test.ts` targets the compliance block during rule updates.
- `npm run test:watch` (`package.json:17`) keeps Jest in watch mode for rapid feedback.
- `npm run test:e2e` (`package.json:14`) will bind Playwright scripts into CI once end-to-end fixtures exist.
- Node 18+ is required to satisfy the Jest/Playwright stack (`package.json:54-56`).

## Expanding coverage and documentation
New policy rules always begin in the Rule Catalog (`RULES_TEST_CASES.md:1-95`). Engineers should document the corresponding critical and happy-path cases before wiring them into `tests/rules/rulesEngine.test.ts:83-474`. Keeping `DEFAULT_RULE_DEFINITIONS` aligned (`src/rules/definitions.ts:407`) ensures the engine doesn’t omit any rule during execution. Each new test pair should reference the relevant QA case identifiers so stakeholders can trace the behavior back to a policy mandate.

## Traceability & QA readiness
The artifacts above (the rule catalog, the Jest suites, the Rules Engine Test Plan, and the policy-linked test cases) form the onboarding story for QA and auditors. Linking `artifacts/phase-4-testing/rules-test-plan.md` and `RULES_TEST_CASES.md` to the QA dashboard highlights how every violation scenario maps to a policy citation, and updating those documents keeps automated assertions aligned with the latest district policies.
