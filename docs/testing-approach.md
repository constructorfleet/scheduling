# Testing Approach for the Scheduling Application

## Compliance-first goals
Every automated verification tier is aligned with the rules catalog, so shifts, qualifications, and approvals stay traceable back to policies. `RULES_TEST_CASES.md:3` explains the QA mandate to link each compliance rule to a specific test fixture and cites how every segment rule (ratio, certifications, coverage, shifts, substitutes, field trips) must be exercised before the week leaves draft. The catalog highlights each rule’s intent—ratio ceilings `RULES_TEST_CASES.md:5`, certification requirements `RULES_TEST_CASES.md:19`, shift/weekly caps `RULES_TEST_CASES.md:32`, segment coverage guardrails `RULES_TEST_CASES.md:45`, substitute parity metadata `RULES_TEST_CASES.md:58`, field-trip ratios `RULES_TEST_CASES.md:71`, and director sign-offs `RULES_TEST_CASES.md:84`—which keeps requirements testable and auditable.

## Rule-level suites (Jest)
The `RulesEngine` wrapper instantiates with the curated rule set exported as `DEFAULT_RULE_DEFINITIONS` so every evaluation flows through the same catalog (`src/rules/engine.ts:4`, `src/rules/definitions.ts:407`). Each definition (ratio `src/rules/definitions.ts:59`, certification `src/rules/definitions.ts:90`, coverage `src/rules/definitions.ts:149`, shift limits `src/rules/definitions.ts:191`, substitute parity `src/rules/definitions.ts:264`, field-trip ratios `src/rules/definitions.ts:316`, sign-off metadata `src/rules/definitions.ts:371`) reuses shared helpers for citations and assignments before emitting `RuleViolation` objects. The Jest harness runs under the `ts-jest` preset and Node environment with a placeholder `setupFilesAfterEnv` entry (`jest.config.ts:3`, `jest.config.ts:9`), so future matchers or global mocks belong in `tests/setupTests.ts:1`.

The test suite at `tests/rules/rulesEngine.test.ts` exercises each rule with both violation and clean fixtures, making it easy to add new scenarios that mirror policy needs:
- Ratio violation and clean paths: `tests/rules/rulesEngine.test.ts:83` and `tests/rules/rulesEngine.test.ts:105`
- Certification gaps and clearance: `tests/rules/rulesEngine.test.ts:132` and `tests/rules/rulesEngine.test.ts:182`
- Segment coverage failures and pass cases: `tests/rules/rulesEngine.test.ts:187` and `tests/rules/rulesEngine.test.ts:211`
- Shift/day-week cap breaches and compliant schedules: `tests/rules/rulesEngine.test.ts:238` and `tests/rules/rulesEngine.test.ts:265`
- Substitute metadata missing vs. approved: `tests/rules/rulesEngine.test.ts:290` and `tests/rules/rulesEngine.test.ts:311`
- Field-trip adult/leader ratios and clean counts: `tests/rules/rulesEngine.test.ts:344` and `tests/rules/rulesEngine.test.ts:384`
- Field-trip sign-off collections and approvals: `tests/rules/rulesEngine.test.ts:429` and `tests/rules/rulesEngine.test.ts:452`

### Future UI & end-to-end tests (Playwright)
Playwright is configured through `npm run test:e2e` (`package.json:14`) and will live under `tests/e2e/` once coverage flows extend past the rules layer. Complementary UI integration checks go into `tests/ui/` so that Scenario-based flows can start under the same Node tooling when the Scheduling UX surfaces more behavior. These directories can host `Page` objects, fixtures, and playwright configs that reference real scheduling journeys as they crystallize.

## Running the suites
 - `npm test` (`package.json:16`) executes Jest over `tests/` and `src/` via the `roots` value declared in `jest.config.ts:6`, so the rules engine tests run quickly during every developer iteration.
- Targeted reruns such as `npm test -- tests/rules/rulesEngine.test.ts` are handy when validating new compliance rules before broader regressions.
- `npm run test:watch` (`package.json:17`) keeps Jest in watch mode for a faster feedback loop.
- `npm run test:e2e` (`package.json:14`) will later drive Playwright scenarios once the directories under `tests/e2e/` and `tests/ui/` gain scripts.

## Adding or updating compliance tests
1. Identify the policy you're encoding via `RULES_TEST_CASES` so you can point future reviewers to a documented source (`RULES_TEST_CASES.md:5`, `RULES_TEST_CASES.md:19`, `RULES_TEST_CASES.md:32`, `RULES_TEST_CASES.md:45`, `RULES_TEST_CASES.md:58`, `RULES_TEST_CASES.md:71`, `RULES_TEST_CASES.md:84`).
2. Wire the scenario into `tests/rules/rulesEngine.test.ts` following the existing fixture helpers (`createSegmentBlock`, `createAssignment`, `createEmployee`) so the context mirrors the segment, certification, coverage, shift, substitute, or field-trip state you need (`tests/rules/rulesEngine.test.ts:83`).
3. Extend `src/rules/definitions.ts` only when a new policy demands a new `RuleDefinition`; keep `DEFAULT_RULE_DEFINITIONS` (`src/rules/definitions.ts:407`) updated so `RulesEngine` continues running the complete catalog.
4. Run `npm test` (or the targeted command) and confirm the new violation/clean pair both exist before checking in.

## Automation & CI notes
- Jest runs with `ts-jest` and Node to avoid DOM dependencies, so CI agents only need Node 18+ (per `package.json:54`).
- `tests/setupTests.ts:1` currently stands as a hook for future shared matchers, spies, or mocks that must run before each test suite.
- Once Playwright scripts exist, `npm run test:e2e` can plug into the same CI pipeline; add a `playwright.config.ts` entry and keep the `tests/e2e/` fixtures synchronized with the rule catalog so directors can see violations surface end-to-end.
