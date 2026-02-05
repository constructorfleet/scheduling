# Testing Approach for the Scheduling Application

## 1. Compliance-first philosophy
Every automated tier starts from the rules catalog so ratios, certifications, coverage, shift caps, substitutes, and field trips stay accountable to district policy. The **Rules Engine Test Plan** catalogs the critical (violation) and happy-path scenarios that each rule must prove before a week moves past draft, and it cross-references the policy citations in `RULES_TEST_CASES.md:1-95`. Those expectations are the spine of every suite below and keep the compliance story auditable for QA, directors, and auditors (`artifacts/phase-4-testing/rules-test-plan.md:1-54`).

## 2. Rule coverage tiers
The plan breaks each rule into “violation” and “clean” fixtures so QA reviewers can see exactly what must trigger a flag and what constitutes a compliant schedule. Beyond guiding engineers, the matrix gives auditors a single source of truth linking violations to policy catalog entries (`artifacts/phase-4-testing/rules-test-plan.md:8-54`).

### Key rule scenarios
- **ratio-segment:** Blocks must never submit with fewer staff than `max(minStaff, ceil(childCount / ratio.childrenPerStaff))`. Violation tests under-assign and clean fixtures prove the enforced minimum (`artifacts/phase-4-testing/rules-test-plan.md:10-14`).
- **certification-per-segment:** Missing required flags (CPR, medical delegation, leader) produce explicit violations; full certification clears the rule (`artifacts/phase-4-testing/rules-test-plan.md:15-19`).
- **segment-coverage:** Leader and medical coverage guardrails show both failure modes and success scenarios (`artifacts/phase-4-testing/rules-test-plan.md:20-24`).
- **shift-break-limits:** Daily and weekly cap breaches use back-to-back assignments while clean tests stay within both caps (`artifacts/phase-4-testing/rules-test-plan.md:25-28`).
- **substitute-parity:** Configurations missing approvals, metadata, or parity fields surface violations; approved requests with approver/timestamp metadata pass (`artifacts/phase-4-testing/rules-test-plan.md:30-33`).
- **field-trip-ratios:** Adult and leader counts are validated against `FieldTripType` minima so both shortage and compliant combinations are recorded (`artifacts/phase-4-testing/rules-test-plan.md:35-38`).
- **field-trip-signoff:** Missing `approverId` or `signedOffAt` triggers violations while full sign-offs are the happy path (`artifacts/phase-4-testing/rules-test-plan.md:40-44`).

### Additional guardrails (QA-RULE catalog)
- **Field-trip ratio overrides:** Once a block is tied to a signed-off field trip, `ratio-segment` defers to `field-trip-ratios`, keeping overrides centralized (`QA-RULE-017` / `tests/rules/rulesEngine.test.ts`).
- **Weekly cap spans days:** Weekly violations surface even if every individual day stays within its cap so cumulative coverage is enforced (`QA-RULE-018` / `tests/rules/rulesEngine.test.ts`).
- **Substitute metadata completeness:** Partial approvals emit violations whose `missing` arrays list each absent attribute, making incomplete requests easy to fix (`QA-RULE-019` / `tests/rules/rulesEngine.test.ts`).
- **Leadership counts remain separate:** Even when adult staffing meets the ratio, leader shortages still violate so leadership coverage cannot be bypassed (`QA-RULE-020` / `tests/rules/rulesEngine.test.ts`).
- **Granular sign-off metadata:** Missing just `approverId` still produces a `field-trip-signoff` violation so every approval field remains explicit (`QA-RULE-021` / `tests/rules/rulesEngine.test.ts`).

## 3. Rule engine suites (Jest)
`RulesEngine` (`src/rules/engine.ts:4`) evaluates `DEFAULT_RULE_DEFINITIONS` (`src/rules/definitions.ts:407`), so every execution path shares the same curated catalog. Each definition—ratios, certifications, coverage, shift limits, substitutes, and field-trip requirements—uses helpers for violation metadata and policy citations before emitting `RuleViolation` objects. The Jest harness (configured in `jest.config.ts:3-10`) runs under `ts-jest` and reserves `tests/setupTests.ts:1` for reusable matchers or spies.

The canonical tests in `tests/rules/rulesEngine.test.ts:83-474` always pair violation and clean fixtures:
- Ratio violation vs. clean sections (`tests/rules/rulesEngine.test.ts:83-211`).
- Certification shortfalls vs. satisfied certification sets (`tests/rules/rulesEngine.test.ts:132-211`).
- Coverage and leader gaps vs. complete coverage assignments (`tests/rules/rulesEngine.test.ts:187-211`).
- Shift/day-week cap breaches vs. compliant time spans (`tests/rules/rulesEngine.test.ts:238-265`).
- Substitute metadata missing vs. approved requests (`tests/rules/rulesEngine.test.ts:290-311`).
- Field-trip ratios vs. compliant adult/leader pools (`tests/rules/rulesEngine.test.ts:344-384`).
- Field-trip sign-off missing data vs. signed-off events (`tests/rules/rulesEngine.test.ts:429-452`).

## 4. Integration and UI automation (Playwright)
Playwright is already wired for future scenario-based flows via `npm run test:e2e` (`package.json:14`). The latest guided-workflow spec (`tests/e2e/guided-workflows.spec.ts:25-65`) explicitly exercises the field-trip and substitute gating the UI must honor before allowing any publish action, verifying that:
- the field-trip card begins blocked with “Field trip needs a director signature,” transitions to “Complete” after “Add director sign-off,” and then enables the publish CTA, and
- the substitute parity panel starts blocked, surfaces the missing metadata, resolves via “Resolve parity,” and finishes ready with the approver/timestamp shown and the resolve button removed.

Future Playwright worktrees in `tests/e2e/` and `tests/ui/` should continue encoding the `QA-RULE-017` through `QA-RULE-021` scenarios so the guided experience reproduces every compliance gate before persistence.

## 5. Running the suites
- `npm test` (`package.json:16`) executes Jest with roots from `jest.config.ts:6`, so rule-engine suites run with every developer iteration.
- `npm test -- tests/rules/rulesEngine.test.ts` focuses on the compliance block during rule updates.
- `npm run test:watch` (`package.json:17`) keeps Jest in watch mode for rapid iteration.
- `npm run test:e2e` (`package.json:14`) chains the Playwright walkthroughs, but it currently fails before the first scenario because the configured Vite web server cannot bind to `127.0.0.1:4174` (“listen EPERM: operation not permitted”), so the guided-workflow suite never starts. Grant Vite permission for that port or adjust `playwright.config.ts` to use an allowed port before rerunning this command to exercise the Field Trip/Substitute gating expectations.
- Node 18+ is required to satisfy the Jest/Playwright stack (`package.json:54-56`).

## 6. Traceability and onboarding
QA, reviewers, and auditors should start with the artifacts in the rule catalog: `RULES_TEST_CASES.md:1-95` and `artifacts/phase-4-testing/rules-test-plan.md`. They narrate each policy with a critical/happy-path pairing and link directly to the Jest fixtures (`tests/rules/rulesEngine.test.ts:83-474`). Keeping `DEFAULT_RULE_DEFINITIONS` aligned (`src/rules/definitions.ts:407`) ensures no rule is accidentally skipped. When adding or updating policy expectations, add the matching pair of fixtures, refer to the QA rule identifier (e.g., `QA-RULE-017`), and update this document so non-technical stakeholders can follow the compliance trail without a live walkthrough.

## 7. Maintaining and expanding coverage
New policy rules begin in the Rule Catalog (`RULES_TEST_CASES.md:1-95`). Before wiring code, document the critical and happy-path cases so the Rules Engine Test Plan and Jest fixtures can be updated in lockstep. Each new fixture pair must cite the relevant QA case identifier, draw its ratios or metadata from the latest policy, and run through `tests/rules/rulesEngine.test.ts`. After the automated coverage is in place, coordinate with the UX team to capture any new interactions in `tests/ui/` or Playwright so the UI also surfaces the violation before the week moves on.

## 8. QA readiness checklist
- Link each new or updated rule to a policy citation in `RULES_TEST_CASES.md` and note it in `artifacts/phase-4-testing/rules-test-plan.md`.
- Pair every violation scenario with a clean fixture inside `tests/rules/rulesEngine.test.ts` that proves the rule clears when compliant.
- Reference the QA rule identifier (e.g., `QA-RULE-017`) in both the test plan and the Jest fixture comments so auditors can trace behavior back to the mandate.
- Run `npm test -- tests/rules/rulesEngine.test.ts` after any rule change to confirm both violation and happy-path branches.
- Document new Playwright or UI automation flows that reproduce the scenarios described above once the workspace UI is live.

## 9. Next steps
1. Publish these guardrail notes to the QA dashboard or tracker that surfaces `RULES_TEST_CASES.md` so auditors can map the documented cases to the guarded scenarios.
2. Coordinate with Ops or local security to allow Playwright’s Vite server to bind to `127.0.0.1:4174` (or adjust `playwright.config.ts` to a permitted port) and rerun `npm run test:e2e` so the guided-workflow assertions for field trips and substitute parity complete.
3. When the scheduling workspace/UI is ready, add integration/end-to-end flows (Playwright or similar) that recreate `QA-RULE-017` through `QA-RULE-021` before allowing a week to progress beyond draft.
