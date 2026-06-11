import { z } from "zod";

export const approverGroups = [
  "Procurement",
  "Security",
  "Finance",
  "DPO",
  "CFO",
  "Compliance",
] as const;

export const conditionOperators = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_or_equal",
  "less_than",
  "less_or_equal",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
  "in",
  "not_in",
] as const;

export const effectTypes = [
  "APPROVE",
  "REQUIRE_REVIEW",
  "REJECT",
  "REQUIRE_FIELD",
  "ADD_RISK_POINTS",
  "ADD_REASON_CODE",
] as const;

export const conditionCombinators = ["ALL", "ANY"] as const;

export type ConditionOperator = (typeof conditionOperators)[number];
export type RuleEffectType = (typeof effectTypes)[number];
export type ConditionCombinator = (typeof conditionCombinators)[number];
export type Decision =
  | "APPROVED"
  | "REQUIRES_REVIEW"
  | "REJECTED"
  | "MISSING_INFORMATION";

export type RequestInput = Record<string, unknown>;

export interface FieldCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ConditionGroup {
  combinator: ConditionCombinator;
  conditions: ConditionNode[];
}

export type ConditionNode = FieldCondition | ConditionGroup;

export interface RuleEffect {
  type: RuleEffectType;
  approver?: string;
  field?: string;
  label?: string;
  code?: string;
  points?: number;
  nextStep?: string;
}

export interface RuleDefinition {
  id?: string;
  name: string;
  description: string;
  severity: "INFO" | "WARNING" | "BLOCKER";
  condition: ConditionNode;
  effects: RuleEffect[];
  reason: string;
  enabled: boolean;
  priority: number;
  policyId: string;
  policyName: string;
  policyDomain: string;
  policyVersionId: string;
  policyVersionNumber: number;
}

export interface PolicyVersionDefinition {
  id: string;
  policyId: string;
  policyName: string;
  policyDomain: string;
  versionNumber: number;
  rules: RuleDefinition[];
}

export interface RuleFact {
  field: string;
  operator: ConditionOperator;
  expected: unknown;
  actual: unknown;
  matched: boolean;
}

export interface RuleEvaluationResult {
  ruleId?: string;
  ruleName: string;
  policyId: string;
  policyName: string;
  policyDomain: string;
  policyVersionId: string;
  policyVersionNumber: number;
  severity: RuleDefinition["severity"];
  matched: boolean;
  reason: string;
  facts: RuleFact[];
  effects: RuleEffect[];
}

export interface MissingField {
  field: string;
  label: string;
}

export interface AppliedPolicyVersion {
  policyId: string;
  policyName: string;
  policyDomain: string;
  policyVersionId: string;
  versionNumber: number;
}

export interface PolicyEvaluationResult {
  decision: Decision;
  reasons: string[];
  missingFields: MissingField[];
  requiredApprovers: string[];
  reasonCodes: string[];
  riskPoints: number;
  nextSteps: string[];
  appliedPolicyVersions: AppliedPolicyVersion[];
  matchedPolicyVersions: AppliedPolicyVersion[];
  ruleResults: RuleEvaluationResult[];
  matchedRules: RuleEvaluationResult[];
}

export const fieldConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(conditionOperators),
  value: z.unknown().optional(),
});

export const conditionSchema = z.lazy(() =>
  z.union([
    fieldConditionSchema,
    z.object({
      combinator: z.enum(conditionCombinators),
      conditions: z.array(conditionSchema).min(1),
    }),
  ]),
) as z.ZodType<ConditionNode>;

export const ruleEffectSchema = z.object({
  type: z.enum(effectTypes),
  approver: z.string().min(1).optional(),
  field: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  points: z.number().optional(),
  nextStep: z.string().min(1).optional(),
});

export const ruleDefinitionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["INFO", "WARNING", "BLOCKER"]),
  condition: conditionSchema,
  effects: z.array(ruleEffectSchema).min(1),
  reason: z.string().min(1),
  enabled: z.boolean(),
  priority: z.number().int(),
  policyId: z.string().min(1),
  policyName: z.string().min(1),
  policyDomain: z.string().min(1),
  policyVersionId: z.string().min(1),
  policyVersionNumber: z.number().int().positive(),
});
