import {
  AppliedPolicyVersion,
  ConditionNode,
  Decision,
  FieldCondition,
  MissingField,
  PolicyEvaluationResult,
  PolicyVersionDefinition,
  RequestInput,
  RuleDefinition,
  RuleEffect,
  RuleEvaluationResult,
  RuleFact,
  ruleDefinitionSchema,
} from "./types";

const decisionRank: Record<Decision, number> = {
  APPROVED: 0,
  REQUIRES_REVIEW: 1,
  MISSING_INFORMATION: 2,
  REJECTED: 3,
};

const isGroup = (condition: ConditionNode): condition is Exclude<ConditionNode, FieldCondition> =>
  "combinator" in condition;

const uniqueBy = <T>(items: T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter(item => {
    const itemKey = key(item);
    if (seen.has(itemKey)) return false;
    seen.add(itemKey);
    return true;
  });
};

const getByPath = (input: RequestInput, path: string): unknown =>
  path.split(".").reduce<unknown>((value, part) => {
    if (value == null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[part];
  }, input);

const isEmpty = (value: unknown) => {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

const toComparableNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
};

const equals = (actual: unknown, expected: unknown) => {
  if (typeof actual === "number" || typeof expected === "number") {
    return toComparableNumber(actual) === toComparableNumber(expected);
  }

  return actual === expected;
};

const includesValue = (container: unknown, value: unknown) => {
  if (Array.isArray(container)) {
    return container.some(item => equals(item, value));
  }

  if (typeof container === "string") {
    return container.toLocaleLowerCase().includes(String(value).toLocaleLowerCase());
  }

  return false;
};

const matchFieldCondition = (condition: FieldCondition, input: RequestInput): RuleFact => {
  const actual = getByPath(input, condition.field);
  const expected = condition.value;
  let matched = false;

  switch (condition.operator) {
    case "equals":
      matched = equals(actual, expected);
      break;
    case "not_equals":
      matched = !equals(actual, expected);
      break;
    case "greater_than":
      matched = toComparableNumber(actual) > toComparableNumber(expected);
      break;
    case "greater_or_equal":
      matched = toComparableNumber(actual) >= toComparableNumber(expected);
      break;
    case "less_than":
      matched = toComparableNumber(actual) < toComparableNumber(expected);
      break;
    case "less_or_equal":
      matched = toComparableNumber(actual) <= toComparableNumber(expected);
      break;
    case "contains":
      matched = includesValue(actual, expected);
      break;
    case "not_contains":
      matched = !includesValue(actual, expected);
      break;
    case "is_empty":
      matched = isEmpty(actual);
      break;
    case "is_not_empty":
      matched = !isEmpty(actual);
      break;
    case "in":
      matched = Array.isArray(expected) && expected.some(item => equals(actual, item));
      break;
    case "not_in":
      matched = Array.isArray(expected) && !expected.some(item => equals(actual, item));
      break;
  }

  return {
    field: condition.field,
    operator: condition.operator,
    expected: expected ?? null,
    actual: actual ?? null,
    matched,
  };
};

const evaluateCondition = (
  condition: ConditionNode,
  input: RequestInput,
): { matched: boolean; facts: RuleFact[] } => {
  if (!isGroup(condition)) {
    const fact = matchFieldCondition(condition, input);
    return { matched: fact.matched, facts: [fact] };
  }

  const evaluated = condition.conditions.map(child => evaluateCondition(child, input));
  const matched =
    condition.combinator === "ALL"
      ? evaluated.every(item => item.matched)
      : evaluated.some(item => item.matched);

  return {
    matched,
    facts: evaluated.flatMap(item => item.facts),
  };
};

const evaluateRule = (rule: RuleDefinition, input: RequestInput): RuleEvaluationResult => {
  const parsed = ruleDefinitionSchema.parse(rule);
  const { matched, facts } = evaluateCondition(parsed.condition, input);

  return {
    ruleId: parsed.id,
    ruleName: parsed.name,
    policyId: parsed.policyId,
    policyName: parsed.policyName,
    policyDomain: parsed.policyDomain,
    policyVersionId: parsed.policyVersionId,
    policyVersionNumber: parsed.policyVersionNumber,
    severity: parsed.severity,
    matched,
    reason: parsed.reason,
    facts,
    effects: parsed.effects as RuleEffect[],
  };
};

const addUniqueString = (items: string[], value?: string) => {
  if (value && !items.includes(value)) {
    items.push(value);
  }
};

const addMissingField = (items: MissingField[], field?: string, label?: string) => {
  if (!field || items.some(item => item.field === field)) return;
  items.push({ field, label: label ?? field });
};

const chooseDecision = (current: Decision, next: Decision): Decision =>
  decisionRank[next] > decisionRank[current] ? next : current;

export const evaluatePolicyVersions = (
  input: RequestInput,
  policyVersions: PolicyVersionDefinition[],
): PolicyEvaluationResult => {
  const appliedPolicyVersions: AppliedPolicyVersion[] = uniqueBy(
    policyVersions.map(policyVersion => ({
      policyId: policyVersion.policyId,
      policyName: policyVersion.policyName,
      policyDomain: policyVersion.policyDomain,
      policyVersionId: policyVersion.id,
      versionNumber: policyVersion.versionNumber,
    })),
    item => item.policyVersionId,
  );

  const rules = policyVersions
    .flatMap(policyVersion => policyVersion.rules)
    .filter(rule => rule.enabled)
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  const ruleResults = rules.map(rule => evaluateRule(rule, input));
  const matchedRules = ruleResults.filter(rule => rule.matched);
  const matchedPolicyVersions: AppliedPolicyVersion[] = uniqueBy(
    matchedRules.map(rule => ({
      policyId: rule.policyId,
      policyName: rule.policyName,
      policyDomain: rule.policyDomain,
      policyVersionId: rule.policyVersionId,
      versionNumber: rule.policyVersionNumber,
    })),
    item => item.policyVersionId,
  );

  let decision: Decision = "APPROVED";
  const reasons: string[] = [];
  const missingFields: MissingField[] = [];
  const requiredApprovers: string[] = [];
  const nextSteps: string[] = [];
  const reasonCodes: string[] = [];
  let riskPoints = 0;

  matchedRules.forEach(rule => {
    addUniqueString(reasons, rule.reason);

    rule.effects.forEach(effect => {
      switch (effect.type) {
        case "APPROVE":
          break;
        case "REJECT":
          decision = chooseDecision(decision, "REJECTED");
          addUniqueString(nextSteps, effect.nextStep ?? "Zatrzymaj wniosek i skontaktuj się z właścicielem polityki.");
          break;
        case "REQUIRE_FIELD":
          decision = chooseDecision(decision, "MISSING_INFORMATION");
          addMissingField(missingFields, effect.field, effect.label);
          addUniqueString(requiredApprovers, effect.approver);
          addUniqueString(nextSteps, effect.nextStep ?? `Uzupełnij wymagane pole: ${effect.label ?? effect.field}.`);
          break;
        case "REQUIRE_REVIEW":
          decision = chooseDecision(decision, "REQUIRES_REVIEW");
          addUniqueString(requiredApprovers, effect.approver);
          addUniqueString(
            nextSteps,
            effect.nextStep ??
              (effect.approver
                ? `Uzyskaj ocenę: ${effect.approver}.`
                : "Przekaż wniosek do ręcznej oceny."),
          );
          break;
        case "ADD_RISK_POINTS":
          riskPoints += effect.points ?? 0;
          break;
        case "ADD_REASON_CODE":
          addUniqueString(reasonCodes, effect.code);
          break;
      }
    });
  });

  if (reasons.length === 0) {
    reasons.push("Żadna aktywna reguła nie wymaga dodatkowej akcji dla tego wniosku.");
  }

  if (nextSteps.length === 0) {
    nextSteps.push("Wniosek może przejść automatycznie według aktywnych polityk.");
  }

  return {
    decision,
    reasons,
    missingFields,
    requiredApprovers,
    reasonCodes,
    riskPoints,
    nextSteps,
    appliedPolicyVersions,
    matchedPolicyVersions,
    ruleResults,
    matchedRules,
  };
};
