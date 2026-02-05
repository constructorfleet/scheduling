import type { RuleDefinition, RuleViolation, RulesContext } from "./types";
import { DEFAULT_RULE_DEFINITIONS } from "./definitions";

export class RulesEngine {
  constructor(private rules: RuleDefinition[] = DEFAULT_RULE_DEFINITIONS) {}

  evaluate(context: RulesContext): RuleViolation[] {
    return this.rules.flatMap((rule) => rule.evaluate(context));
  }
}

export const createRulesEngine = (rules: RuleDefinition[] = DEFAULT_RULE_DEFINITIONS) =>
  new RulesEngine(rules);
